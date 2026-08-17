import axios from 'axios';
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';

import { emitAuthLost, getAccessToken, setAccessToken } from './authTokenStore';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// No interceptors — a 401 from /auth/refresh itself must not re-enter the
// handler below and recurse.
const refreshClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
});

const REFRESH_TOKEN_KEY = 'ch_refresh_token';

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setStoredRefreshToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

function isAuthPath(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/github')
  );
}

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
}

let inFlight: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  inFlight ??= (async () => {
    const stored = await getStoredRefreshToken();
    if (!stored) {
      throw new Error('No refresh token available');
    }
    const { data } = await refreshClient.post<RefreshResponse>('/auth/refresh', {
      refreshToken: stored,
    });
    setAccessToken(data.accessToken);
    // A body-based refresh (native) always returns a newly-rotated refresh
    // token — it must be re-persisted every time, not just the access token.
    if (data.refreshToken) {
      await setStoredRefreshToken(data.refreshToken);
    }
    return data.accessToken;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const config = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status !== 401 ||
      !config ||
      config._retry ||
      isAuthPath(config.url)
    ) {
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      const token = await refreshAccessToken();
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return await axiosInstance(config);
    } catch {
      setAccessToken(null);
      await setStoredRefreshToken(null);
      const code =
        (error.response?.data as { error?: { code?: string } } | undefined)
          ?.error?.code ?? 'UNAUTHORIZED';
      emitAuthLost(code);
      return Promise.reject(error);
    }
  },
);

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    axiosInstance.get<T>(url, { params }).then((r) => r.data),

  post: <T>(url: string, data?: unknown) =>
    axiosInstance.post<T>(url, data).then((r) => r.data),

  put: <T>(url: string, data?: unknown) =>
    axiosInstance.put<T>(url, data).then((r) => r.data),

  patch: <T>(url: string, data?: unknown) =>
    axiosInstance.patch<T>(url, data).then((r) => r.data),

  delete: <T>(url: string) =>
    axiosInstance.delete<T>(url).then((r) => r.data),
};

export { axiosInstance };
