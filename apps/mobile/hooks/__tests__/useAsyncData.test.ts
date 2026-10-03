import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';

import { useAsyncData } from '../useAsyncData';
import { deferred } from '../../test/utils';

const serverError = () =>
  new AxiosError('boom', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 500 } as AxiosResponse);

const SERVER_ERROR_MESSAGE = 'The server had a problem. Please try again.';

describe('useAsyncData', () => {
  it('loads data on mount', async () => {
    const request = deferred<string>();
    const { result } = await renderHook(() => useAsyncData(() => request.promise));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await act(async () => request.resolve('repos'));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('repos');
    expect(result.current.error).toBeNull();
  });

  it('shows a friendly message when the request fails', async () => {
    const { result } = await renderHook(() => useAsyncData(() => Promise.reject(serverError())));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(SERVER_ERROR_MESSAGE);
    expect(result.current.data).toBeNull();
  });

  it('marks a pull-to-refresh as refreshing, not loading', async () => {
    const fetcher = jest.fn<Promise<string>, []>().mockResolvedValueOnce('first');
    const { result } = await renderHook(() => useAsyncData(fetcher));
    await waitFor(() => expect(result.current.data).toBe('first'));

    const refresh = deferred<string>();
    fetcher.mockReturnValueOnce(refresh.promise);
    await act(async () => {
      void result.current.load(true);
    });

    expect(result.current.refreshing).toBe(true);
    expect(result.current.loading).toBe(false);

    await act(async () => refresh.resolve('second'));
    expect(result.current.refreshing).toBe(false);
    expect(result.current.data).toBe('second');
  });

  it('keeps the old data when a refresh fails', async () => {
    const fetcher = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(serverError());
    const { result } = await renderHook(() => useAsyncData(fetcher));
    await waitFor(() => expect(result.current.data).toBe('first'));

    await act(async () => {
      await result.current.load(true);
    });

    expect(result.current.data).toBe('first');
    expect(result.current.error).toBe(SERVER_ERROR_MESSAGE);
    expect(result.current.refreshing).toBe(false);
  });

  it('ignores a second load while one is still running', async () => {
    const request = deferred<string>();
    const fetcher = jest.fn(() => request.promise);
    const { result } = await renderHook(() => useAsyncData(fetcher));

    await act(async () => {
      void result.current.load();
      void result.current.load(true);
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => request.resolve('done'));
  });

  it('drops a late response for the previous deps', async () => {
    const forA = deferred<string>();
    const forB = deferred<string>();
    const fetcher = jest
      .fn<Promise<string>, []>()
      .mockReturnValueOnce(forA.promise)
      .mockReturnValueOnce(forB.promise);
    const { result, rerender } = await renderHook(
      ({ orgId }: { orgId: string }) => useAsyncData(fetcher, [orgId]),
      { initialProps: { orgId: 'a' } },
    );

    await rerender({ orgId: 'b' });
    await act(async () => forB.resolve('org b repos'));
    await act(async () => forA.resolve('org a repos'));

    expect(result.current.data).toBe('org b repos');
  });
});
