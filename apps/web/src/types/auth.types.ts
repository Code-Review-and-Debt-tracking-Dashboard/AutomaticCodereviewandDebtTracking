// TODO(Backend): These types should match your API response schemas from /api/auth/*

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  githubUsername: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginResponse {
  user: User;
  token: string;
}
