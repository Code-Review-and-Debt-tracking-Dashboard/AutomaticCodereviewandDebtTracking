import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { AuthProvider, useAuth } from '../AuthContext';
import { api } from '../../lib/apiClient';
import { getAccessToken } from '../../lib/authTokenStore';
import { unregisterFromPush } from '../../lib/pushNotifications';
import { apiMock, requestsTo, seedRefreshToken, sentBody, storedRefreshToken } from '../../test/utils';

const ME = { id: 'u1', username: 'vidushi', email: null, avatarUrl: null, platformRole: 'USER' };

// real AuthProvider, apiClient and token store. only the network and the browser are fake
function Probe() {
  const { user, isLoading, login, logout } = useAuth();
  const status = isLoading ? 'loading' : user ? `signed in as ${user.username}` : 'signed out';
  return (
    <View>
      <Text>{status}</Text>
      <Pressable onPress={() => void login()}>
        <Text>GitHub login</Text>
      </Pressable>
      <Pressable onPress={() => void logout()}>
        <Text>Logout</Text>
      </Pressable>
    </View>
  );
}

const renderAuth = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

// a saved session that /auth/refresh accepts once
async function renderSignedIn() {
  seedRefreshToken('refresh-1');
  apiMock.onPost('/auth/refresh').replyOnce(200, { accessToken: 'access-1', refreshToken: 'refresh-2' });
  apiMock.onGet('/auth/me').reply(200, ME);
  await renderAuth();
  await screen.findByText('signed in as vidushi');
}

describe('AuthContext', () => {
  describe('on app start', () => {
    it('shows the signed-out state without calling the API when nothing is saved', async () => {
      await renderAuth();

      expect(await screen.findByText('signed out')).toBeOnTheScreen();
      expect(apiMock.history.post).toHaveLength(0);
      expect(apiMock.history.get).toHaveLength(0);
    });

    it('restores a saved session with a refresh', async () => {
      await renderSignedIn();

      expect(sentBody('post', '/auth/refresh')).toEqual({ refreshToken: 'refresh-1' });
      expect(requestsTo('get', '/auth/me')[0].headers?.Authorization).toBe('Bearer access-1');
      expect(storedRefreshToken()).toBe('refresh-2');
    });

    it('clears a saved session the API rejects', async () => {
      seedRefreshToken('revoked');
      apiMock.onPost('/auth/refresh').reply(401);
      await renderAuth();

      expect(await screen.findByText('signed out')).toBeOnTheScreen();
      expect(storedRefreshToken()).toBeNull();
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('GitHub login', () => {
    it('stores the tokens from the redirect and loads the user', async () => {
      jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
        type: 'success',
        url: 'codehealth://auth?accessToken=access-1&refreshToken=refresh-1',
      });
      jest.mocked(Linking.parse).mockReturnValue({
        scheme: 'codehealth',
        hostname: 'auth',
        path: null,
        queryParams: { accessToken: 'access-1', refreshToken: 'refresh-1' },
      });
      apiMock.onGet('/auth/me').reply(200, ME);
      await renderAuth();
      await screen.findByText('signed out');

      await fireEvent.press(screen.getByText('GitHub login'));

      expect(await screen.findByText('signed in as vidushi')).toBeOnTheScreen();
      expect(jest.mocked(WebBrowser.openAuthSessionAsync).mock.calls[0][0]).toContain('client=native');
      expect(getAccessToken()).toBe('access-1');
      expect(storedRefreshToken()).toBe('refresh-1');
    });

    it('does nothing when the user closes the browser', async () => {
      jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
        type: WebBrowser.WebBrowserResultType.CANCEL,
      });
      await renderAuth();
      await screen.findByText('signed out');

      await fireEvent.press(screen.getByText('GitHub login'));

      expect(screen.getByText('signed out')).toBeOnTheScreen();
      expect(requestsTo('get', '/auth/me')).toHaveLength(0);
      expect(storedRefreshToken()).toBeNull();
    });
  });

  describe('logout', () => {
    it('removes the push device first, then clears the session even if the API call fails', async () => {
      await renderSignedIn();
      let logoutCallsWhenUnregistering = -1;
      jest.mocked(unregisterFromPush).mockImplementationOnce(async () => {
        logoutCallsWhenUnregistering = requestsTo('post', '/auth/logout').length;
      });
      apiMock.onPost('/auth/logout').reply(500);

      await fireEvent.press(screen.getByText('Logout'));

      expect(await screen.findByText('signed out')).toBeOnTheScreen();
      expect(logoutCallsWhenUnregistering).toBe(0);
      expect(sentBody('post', '/auth/logout')).toEqual({ refreshToken: 'refresh-2' });
      expect(getAccessToken()).toBeNull();
      expect(storedRefreshToken()).toBeNull();
    });
  });

  it('signs the user out when the session expires mid-use', async () => {
    await renderSignedIn();
    apiMock.onGet('/api/orgs').reply(401);
    apiMock.onPost('/auth/refresh').reply(401);

    await act(async () => {
      await api.get('/api/orgs').catch(() => undefined);
    });

    expect(await screen.findByText('signed out')).toBeOnTheScreen();
  });
});
