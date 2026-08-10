import axios from "axios";
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import {
  emitAuthLost,
  getAccessToken,
  setAccessToken,
} from "./authTokenStore";

/*
 * =========================================================
 * API CLIENT MODULE
 * =========================================================
 *
 * Central HTTP client for every API call the dashboard makes.
 *
 * - Base URL comes from VITE_API_URL (defaults to localhost:4000).
 * - Access token is held in memory and attached as a Bearer header.
 * - A 401 triggers one refresh, then the original request is replayed.
 *
 * Usage:
 *   import { api } from "@/lib/apiClient";
 *   const repos = await api.get<Repo[]>("/api/orgs/abc/repos");
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/**
 * Shared Axios instance used by every page and hook.
 * withCredentials so the refresh cookie rides along on /auth calls.
 */
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

/*
 * Separate instance with no interceptors. If the refresh call went through
 * axiosInstance, a 401 from /auth/refresh would re-enter the handler below
 * and recurse.
 */
const refreshClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
});

/** Paths that must never trigger a refresh-and-retry. */
function isAuthPath(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout") ||
    url.includes("/auth/github")
  );
}

/*
 * =========================================================
 * REQUEST INTERCEPTOR — attach the in-memory access token
 * =========================================================
 */

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

/*
 * =========================================================
 * REFRESH — single flight
 * =========================================================
 *
 * Every 401 that lands while a refresh is already running awaits the same
 * promise, so N expired requests cause exactly one POST /auth/refresh.
 */

interface RefreshResponse {
  accessToken: string;
}

let inFlight: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  inFlight ??= refreshClient
    .post<RefreshResponse>("/auth/refresh")
    .then((r) => {
      setAccessToken(r.data.accessToken);
      return r.data.accessToken;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/*
 * =========================================================
 * RESPONSE INTERCEPTOR — refresh once, then replay
 * =========================================================
 */

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
      const code =
        (error.response?.data as { error?: { code?: string } } | undefined)
          ?.error?.code ?? "UNAUTHORIZED";
      emitAuthLost(code);
      return Promise.reject(error);
    }
  },
);

/** True for 401s, so React Query can skip retrying them. */
export function isUnauthorized(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 401;
}

/*
 * =========================================================
 * TYPED HELPERS
 * =========================================================
 *
 * Thin wrappers that return `response.data` directly so
 * callers don't have to unwrap the Axios envelope every time.
 */

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

/** The raw Axios instance for advanced use cases. */
export { axiosInstance };

/** The resolved API base URL (useful for OAuth redirect). */
export { API_BASE_URL };
