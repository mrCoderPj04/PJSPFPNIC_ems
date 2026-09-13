'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  employeeId: string;
  username: string;
  role: 'ADMIN' | 'EMPLOYEE';
  email?: string;
  photoUrl?: string;
  salary?: number;
  department?: string;
  designation?: string;
  status: string;
  isFirstLogin: boolean;
}

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (employeeId: string, password: string) => Promise<{ requirePasswordChange: boolean }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserPhoto: (photoUrl: string) => void;
  refreshAccessToken: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      if (accessToken) {
        await fetch(`${API}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } catch { /* ignore */ }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('refreshToken');
    router.replace('/');
  }, [accessToken, router]);

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) { logout(); return; }

    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) { logout(); return; }
    const data = await res.json();
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
  }, [logout]);

  // Restore session on mount
  useEffect(() => {
    const init = async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) { setIsLoading(false); return; }

      try {
        const res = await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) { setIsLoading(false); return; }
        const data = await res.json();
        setAccessToken(data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Fetch current user
        const meRes = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setUser(meData.user);
        }
      } catch { /* ignore */ }
      setIsLoading(false);
    };
    init();
  }, []);

  // Auto-refresh access token every 14 minutes
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(refreshAccessToken, 14 * 60 * 1000);
    return () => clearInterval(interval);
  }, [accessToken, refreshAccessToken]);

  const login = useCallback(async (employeeId: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem('refreshToken', data.refreshToken);

    return { requirePasswordChange: data.requirePasswordChange };
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await fetch(`${API}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to change password');
    }

    setUser((prev) => prev ? { ...prev, isFirstLogin: false } : null);
  }, [accessToken]);

  const updateUserPhoto = useCallback((photoUrl: string) => {
    setUser((prev) => prev ? { ...prev, photoUrl } : null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch { /* ignore */ }
  }, [accessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user && !!accessToken,
        login,
        logout,
        changePassword,
        updateUserPhoto,
        refreshAccessToken,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
