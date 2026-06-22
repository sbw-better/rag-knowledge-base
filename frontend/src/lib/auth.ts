import type { UserResponse } from "../types";

const TOKEN_KEY = "ragkb.token";
const USER_KEY = "ragkb.user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: UserResponse) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("auth-changed"));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("auth-changed"));
}

export function getStoredUser(): UserResponse | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as UserResponse;
  } catch {
    clearAuth();
    return null;
  }
}
