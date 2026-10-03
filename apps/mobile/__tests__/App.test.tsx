import { fireEvent, render, screen } from '@testing-library/react-native';

import App from '../App';
import { apiMock, requestsTo, seedRefreshToken } from '../test/utils';

const ME = { id: 'u1', username: 'vidushi', email: null, avatarUrl: null, platformRole: 'USER' };
const ORG = { id: 'org-1', login: 'acme', name: 'Acme' };
const REPO = { id: 'repo-1', name: 'payments-api', fullName: 'acme/payments-api' };

// what a healthy signed-in session sees on the first two tabs
function mockSignedInApi() {
  apiMock.onPost('/auth/refresh').replyOnce(200, { accessToken: 'access-1', refreshToken: 'refresh-2' });
  apiMock.onGet('/auth/me').reply(200, ME);
  apiMock.onGet('/api/orgs').reply(200, { data: [ORG] });
  apiMock.onGet('/api/mobile/summary').reply(200, {
    user: { username: 'vidushi', avatarUrl: null },
    unreadNotifications: 0,
    repos: [
      {
        ...REPO,
        healthScore: 82,
        scoreChange: 0,
        openPRs: 1,
        criticalIssues: 0,
        lastAnalyzedAt: new Date().toISOString(),
      },
    ],
  });
  apiMock.onGet(`/api/orgs/${ORG.id}/repos`).reply(200, {
    data: [
      {
        ...REPO,
        language: 'TypeScript',
        healthScore: 82,
        openFindings: 3,
        debtMinutes: 125,
        private: false,
      },
    ],
  });
  apiMock.onGet(`/api/repos/${REPO.id}/trend?days=30`).reply(200, {
    dataPoints: [
      { date: '2026-09-30T10:00:00.000Z', healthScore: 80 },
      { date: '2026-10-01T10:00:00.000Z', healthScore: 82 },
    ],
  });
  apiMock.onGet(`/api/repos/${REPO.id}`).reply(200, {
    healthScore: 82,
    openFindings: 3,
    debtMinutes: 125,
    lastAnalyzedAt: new Date().toISOString(),
  });
  apiMock.onGet(`/api/repos/${REPO.id}/debt`).reply(200, {
    totalDebtMinutes: 125,
    debtDelta: 0,
    breakdown: {
      vulnerability: { count: 1, debtMinutes: 60 },
      complexity: { count: 1, debtMinutes: 45 },
      duplication: { count: 0, debtMinutes: 0 },
      code_smell: { count: 1, debtMinutes: 20 },
      maintainability: { count: 0, debtMinutes: 0 },
    },
  });
  apiMock.onGet(`/api/mobile/repos/${REPO.id}/smells?limit=5`).reply(200, {
    totalSmells: 1,
    smells: [
      {
        file: 'src/payments/charge.ts',
        line: 42,
        severity: 'HIGH',
        rule: 'no-floating-promises',
        message: 'Promise returned by charge() is not awaited',
        isNew: true,
      },
    ],
  });
}

// the whole app: providers, auth, navigation and screens. only the network is fake
describe('App', () => {
  it('shows the login screen when there is no saved session', async () => {
    await render(<App />);

    expect(await screen.findByText('Continue with GitHub')).toBeOnTheScreen();
  });

  it('restores the session and walks from the overview to a repository summary', async () => {
    seedRefreshToken('refresh-1');
    mockSignedInApi();

    await render(<App />);

    expect(await screen.findByText('Health across Acme')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('Repositories, tab, 2 of 4'));
    const repoRow = await screen.findByLabelText(/^payments-api, health score 82/);
    expect(screen.getByText('Acme · 1 linked')).toBeOnTheScreen();

    await fireEvent.press(repoRow);

    expect(await screen.findByText('Promise returned by charge() is not awaited')).toBeOnTheScreen();
    expect(screen.getByText('Health Score')).toBeOnTheScreen();
    expect(screen.getAllByText('2h 5m').length).toBeGreaterThan(0);
    expect(requestsTo('get', `/api/repos/${REPO.id}/debt`)).toHaveLength(1);
  });

  it('goes back to the login screen when the session expires mid-use', async () => {
    seedRefreshToken('refresh-1');
    mockSignedInApi();
    await render(<App />);
    await screen.findByText('Health across Acme');

    // the access token expires and the refresh token has been revoked
    apiMock.resetHandlers();
    apiMock.onGet(/.*/).reply(401, { error: { code: 'UNAUTHORIZED' } });
    apiMock.onPost('/auth/refresh').reply(401);

    await fireEvent.press(screen.getByLabelText('Repositories, tab, 2 of 4'));

    expect(await screen.findByText('Continue with GitHub')).toBeOnTheScreen();
  });
});
