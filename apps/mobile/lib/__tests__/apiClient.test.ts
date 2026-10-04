import { api, refreshAccessToken } from '../apiClient';
import { getAccessToken, onAuthLost, setAccessToken } from '../authTokenStore';
import { apiMock, requestsTo, seedRefreshToken, sentBody, storedRefreshToken } from '../../test/utils';

// refresh replies a moment later, so parallel 401s overlap with it like they do on a phone
const slowRefresh = (accessToken: string, refreshToken: string) => () =>
  new Promise<[number, unknown]>((resolve) =>
    setTimeout(() => resolve([200, { accessToken, refreshToken }]), 10),
  );

describe('apiClient', () => {
  it('sends the access token as a bearer header', async () => {
    setAccessToken('access-1');
    apiMock.onGet('/api/orgs').reply(200, { data: [] });

    await api.get('/api/orgs');

    expect(apiMock.history.get[0].headers?.Authorization).toBe('Bearer access-1');
  });

  it('sends no auth header when signed out', async () => {
    apiMock.onGet('/api/orgs').reply(200, { data: [] });

    await api.get('/api/orgs');

    expect(apiMock.history.get[0].headers?.Authorization).toBeUndefined();
  });

  describe('when a request gets a 401', () => {
    beforeEach(() => {
      setAccessToken('expired');
      seedRefreshToken('refresh-1');
    });

    it('refreshes, saves the rotated refresh token and retries with the new token', async () => {
      apiMock
        .onGet('/api/orgs').replyOnce(401)
        .onGet('/api/orgs').replyOnce(200, { data: ['org'] });
      apiMock.onPost('/auth/refresh').reply(200, { accessToken: 'access-2', refreshToken: 'refresh-2' });

      await expect(api.get('/api/orgs')).resolves.toEqual({ data: ['org'] });

      expect(sentBody('post', '/auth/refresh')).toEqual({ refreshToken: 'refresh-1' });
      expect(apiMock.history.get[1].headers?.Authorization).toBe('Bearer access-2');
      expect(getAccessToken()).toBe('access-2');
      expect(storedRefreshToken()).toBe('refresh-2');
    });

    it('makes only one refresh call when several requests fail at once', async () => {
      apiMock
        .onGet('/a').replyOnce(401)
        .onGet('/b').replyOnce(401)
        .onGet('/c').replyOnce(401)
        .onGet(/^\/[abc]$/).reply(200, {});
      apiMock.onPost('/auth/refresh').reply(slowRefresh('access-2', 'refresh-2'));

      await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);

      expect(requestsTo('post', '/auth/refresh')).toHaveLength(1);
      expect(apiMock.history.get).toHaveLength(6);
    });

    it('signs out and reports the API error code when the refresh fails', async () => {
      const lost = jest.fn();
      const unsubscribe = onAuthLost(lost);
      apiMock.onGet('/api/orgs').reply(401, { error: { code: 'TOKEN_EXPIRED' } });
      apiMock.onPost('/auth/refresh').reply(401);

      await expect(api.get('/api/orgs')).rejects.toMatchObject({ response: { status: 401 } });

      expect(getAccessToken()).toBeNull();
      expect(storedRefreshToken()).toBeNull();
      expect(lost).toHaveBeenCalledWith('TOKEN_EXPIRED');
      unsubscribe();
    });

    it('reports UNAUTHORIZED when the 401 has no error code', async () => {
      const lost = jest.fn();
      const unsubscribe = onAuthLost(lost);
      apiMock.onGet('/api/orgs').reply(401);
      apiMock.onPost('/auth/refresh').reply(401);

      await expect(api.get('/api/orgs')).rejects.toBeDefined();

      expect(lost).toHaveBeenCalledWith('UNAUTHORIZED');
      unsubscribe();
    });

    it('gives up after one retry instead of looping', async () => {
      apiMock.onGet('/api/orgs').reply(401);
      apiMock.onPost('/auth/refresh').reply(200, { accessToken: 'access-2', refreshToken: 'refresh-2' });

      await expect(api.get('/api/orgs')).rejects.toMatchObject({ response: { status: 401 } });

      expect(requestsTo('get', '/api/orgs')).toHaveLength(2);
      expect(requestsTo('post', '/auth/refresh')).toHaveLength(1);
    });

    it('does not refresh for a 401 from the auth routes', async () => {
      apiMock.onPost('/auth/logout').reply(401);

      await expect(api.post('/auth/logout', {})).rejects.toBeDefined();

      expect(requestsTo('post', '/auth/refresh')).toHaveLength(0);
    });
  });

  it('passes other errors straight through without refreshing', async () => {
    seedRefreshToken('refresh-1');
    apiMock.onGet('/api/orgs').reply(500);

    await expect(api.get('/api/orgs')).rejects.toMatchObject({ response: { status: 500 } });

    expect(requestsTo('post', '/auth/refresh')).toHaveLength(0);
    expect(storedRefreshToken()).toBe('refresh-1');
  });

  it('fails to refresh without a stored refresh token', async () => {
    await expect(refreshAccessToken()).rejects.toThrow('No refresh token available');

    expect(requestsTo('post', '/auth/refresh')).toHaveLength(0);
  });
});
