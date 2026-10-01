"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface AuthState {
  access:   string | null;
  username: string | null;
}

interface AuthContextValue extends AuthState {
  login:   (username: string, password: string) => Promise<void>;
  logout:  () => void;
  isReady: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth]       = useState<AuthState>({ access: null, username: null });
  const [isReady, setIsReady] = useState(false);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const access   = localStorage.getItem("sv_access");
    const username = localStorage.getItem("sv_username");
    if (access) setAuth({ access, username });
    setIsReady(true);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/token/`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail ?? "Invalid credentials");
    }
    const { access, refresh } = await res.json();
    localStorage.setItem("sv_access",   access);
    localStorage.setItem("sv_refresh",  refresh);
    localStorage.setItem("sv_username", username);
    setAuth({ access, username });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("sv_access");
    localStorage.removeItem("sv_refresh");
    localStorage.removeItem("sv_username");
    setAuth({ access: null, username: null });
  }, []);

  // Silent refresh 5 minutes before the 8-hour window closes
  useEffect(() => {
    if (!auth.access) return;
    const REFRESH_MS = (8 * 60 - 5) * 60 * 1000;
    const timer = setTimeout(async () => {
      const refresh = localStorage.getItem("sv_refresh");
      if (!refresh) return;
      try {
        const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ refresh }),
        });
        if (res.ok) {
          const { access } = await res.json();
          localStorage.setItem("sv_access", access);
          setAuth(a => ({ ...a, access }));
        } else {
          logout();
        }
      } catch {
        logout();
      }
    }, REFRESH_MS);
    return () => clearTimeout(timer);
  }, [auth.access, logout]);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Authenticated fetch — attaches Bearer token, redirects to /login on 401 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const access = localStorage.getItem("sv_access");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  return res;
}
