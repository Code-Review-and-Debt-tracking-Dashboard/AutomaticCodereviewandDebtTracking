import axios from "axios";
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

/*
 * =========================================================
 * API CLIENT MODULE (D-05)
 * =========================================================
 *
 * Central HTTP client for every API call the dashboard makes.
 *
 * - Base URL comes from VITE_API_URL (defaults to localhost:4000).
 * - Auth interceptor attaches the Bearer token from localStorage.
 * - 401 responses clear the token and redirect to /login.
 *
 * Usage:
 *   import { api } from "@/lib/apiClient";
 *   const repos = await api.get<Repo[]>("/api/orgs/abc/repos");
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/**
 * Shared Axios instance used by every page and hook.
 */
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
});

/*
 * =========================================================
 * REQUEST INTERCEPTOR — attach Bearer token
 * =========================================================
 */

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

/*
 * =========================================================
 * RESPONSE INTERCEPTOR — handle 401 globally
 * =========================================================
 *
 * When the API returns 401 the token is invalid or expired.
 * Clear local auth state and redirect to /login so the
 * user can re-authenticate through GitHub.
 */

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const currentToken = localStorage.getItem("token");
    if (error.response?.status === 401 && currentToken !== "demo-token") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Only redirect if we are not already on the login or callback pages
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/auth")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

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
