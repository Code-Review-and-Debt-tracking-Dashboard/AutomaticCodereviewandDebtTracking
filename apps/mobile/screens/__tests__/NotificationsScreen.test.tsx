import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import NotificationsScreen from '../NotificationsScreen';
import { apiMock, renderWithProviders, requestsTo, seedPreferences } from '../../test/utils';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const now = new Date().toISOString();
const NOTIFICATIONS = [
  {
    id: 'n1',
    type: 'QUALITY_GATE_FAILED',
    title: 'Quality gate failed on api',
    body: 'Health score dropped to 61',
    readAt: null,
    createdAt: now,
    repository: { id: 'repo-api', name: 'api' },
  },
  {
    id: 'n2',
    type: 'CRITICAL_FINDING',
    title: 'Critical finding in web',
    body: 'Hard-coded secret in src/config.ts',
    readAt: null,
    createdAt: now,
    repository: { id: 'repo-web', name: 'web' },
  },
  {
    id: 'n3',
    type: 'ANALYSIS_COMPLETED',
    title: 'Analysis finished',
    body: 'No new issues',
    readAt: now,
    createdAt: now,
    repository: null,
  },
];

// real screen, hook, apiClient and preferences. only the network and navigation are fake
describe('NotificationsScreen', () => {
  it('lists notifications with the unread count', async () => {
    apiMock.onGet('/api/notifications').reply(200, { data: NOTIFICATIONS });

    await renderWithProviders(<NotificationsScreen />);

    expect(await screen.findByText('Quality gate failed on api')).toBeOnTheScreen();
    expect(screen.getByText('Critical finding in web')).toBeOnTheScreen();
    expect(screen.getByText('Analysis finished')).toBeOnTheScreen();
    expect(screen.getByText('2 unread')).toBeOnTheScreen();
  });

  it('shows the empty state when there is nothing', async () => {
    apiMock.onGet('/api/notifications').reply(200, { data: [] });

    await renderWithProviders(<NotificationsScreen />);

    expect(await screen.findByText("You're all caught up")).toBeOnTheScreen();
    expect(screen.getByText('All read')).toBeOnTheScreen();
  });

  it('shows an error and loads again on retry', async () => {
    apiMock
      .onGet('/api/notifications').replyOnce(500)
      .onGet('/api/notifications').reply(200, { data: NOTIFICATIONS });

    await renderWithProviders(<NotificationsScreen />);

    expect(await screen.findByText("Couldn't load notifications")).toBeOnTheScreen();
    expect(screen.getByText('The server had a problem. Please try again.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Retry'));

    expect(await screen.findByText('Quality gate failed on api')).toBeOnTheScreen();
  });

  it('marks an unread notification read and opens its repository', async () => {
    apiMock.onGet('/api/notifications').reply(200, { data: NOTIFICATIONS });
    apiMock.onPut('/api/notifications/n1/read').reply(200, {});
    await renderWithProviders(<NotificationsScreen />);

    await fireEvent.press(await screen.findByText('Quality gate failed on api'));

    expect(await screen.findByText('1 unread')).toBeOnTheScreen();
    expect(requestsTo('put', '/api/notifications/n1/read')).toHaveLength(1);
    expect(mockNavigate).toHaveBeenCalledWith('Repositories', {
      screen: 'RepoSummary',
      params: { repoId: 'repo-api', repoName: 'api' },
    });
  });

  it('keeps a notification unread when the server refuses', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    apiMock.onGet('/api/notifications').reply(200, { data: NOTIFICATIONS });
    apiMock.onPut('/api/notifications/n1/read').reply(500);
    await renderWithProviders(<NotificationsScreen />);

    await fireEvent.press(await screen.findByText('Quality gate failed on api'));

    expect(alert).toHaveBeenCalledWith(
      "Couldn't mark it as read",
      'The server had a problem. Please try again.',
    );
    expect(screen.getByText('2 unread')).toBeOnTheScreen();
    alert.mockRestore();
  });

  it('marks everything read', async () => {
    apiMock.onGet('/api/notifications').reply(200, { data: NOTIFICATIONS });
    apiMock.onPut('/api/notifications/read-all').reply(200, {});
    await renderWithProviders(<NotificationsScreen />);

    await fireEvent.press(await screen.findByText('Mark all read'));

    expect(await screen.findByText('All read')).toBeOnTheScreen();
    expect(screen.queryByText('Mark all read')).not.toBeOnTheScreen();
    expect(requestsTo('put', '/api/notifications/read-all')).toHaveLength(1);
  });

  it('shows the paused state when notifications are off, and can turn them back on', async () => {
    seedPreferences({ notificationsEnabled: false });
    apiMock.onGet('/api/notifications').reply(200, { data: NOTIFICATIONS });
    await renderWithProviders(<NotificationsScreen />);

    expect(await screen.findByText('Notifications are off')).toBeOnTheScreen();
    expect(screen.queryByText('Quality gate failed on api')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Turn on notifications'));

    expect(await screen.findByText('Quality gate failed on api')).toBeOnTheScreen();
  });
});
