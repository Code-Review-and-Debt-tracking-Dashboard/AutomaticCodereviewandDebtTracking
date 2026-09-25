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



const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000";

//main axios client
const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,//server respond is need to come before 15 seconds otherwise request fail
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});


const refreshClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
});


function isAuthPath(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout") ||
    url.includes("/auth/github")
  );
}
//runs automatically before or after an HTTP request
//before going to backend
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();//get access token

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);



interface RefreshResponse {
  accessToken: string;
}

let inFlight: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  inFlight ??= refreshClient
    .post<RefreshResponse>("/auth/refresh")
    .then((r) => {
      setAccessToken(r.data.accessToken);//new access token save
      return r.data.accessToken;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}


//after comin responds
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,/*200 OK*/
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
      const token = await refreshAccessToken();//sends a request to your refresh endpoint,
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

//to checkerror is401
export function isUnauthorized(error: unknown): boolean {
  return (error as AxiosError)?.response?.status === 401;
}



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


export { API_BASE_URL };
