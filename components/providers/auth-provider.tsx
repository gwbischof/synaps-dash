'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { TiledUser } from '@/lib/tiled/types';
import {
  getStoredTokens,
  loginWithPassword,
  logout as tiledLogout,
  getCurrentUser,
  refreshAccessToken,
  isTokenExpired,
} from '@/lib/tiled/auth';

interface AuthState {
  user: TiledUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    accessToken: null,
  });

  const checkAuth = useCallback(async () => {
    const { accessToken } = getStoredTokens();

    if (!accessToken) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        accessToken: null,
      });
      return;
    }

    // Refresh if expired
    if (isTokenExpired()) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          accessToken: null,
        });
        return;
      }
    }

    const { accessToken: currentToken } = getStoredTokens();
    if (!currentToken) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        accessToken: null,
      });
      return;
    }

    const user = await getCurrentUser(currentToken);

    setState({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      accessToken: currentToken,
    });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Schedule token refresh
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const { expiresAt } = getStoredTokens();
    if (!expiresAt) return;

    const refreshIn = expiresAt - Date.now() - 60000; // 1 minute before expiry
    if (refreshIn <= 0) return;

    const timeout = setTimeout(async () => {
      await refreshAccessToken();
      checkAuth();
    }, refreshIn);

    return () => clearTimeout(timeout);
  }, [state.isAuthenticated, state.accessToken, checkAuth]);

  const login = async (username: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const tokens = await loginWithPassword(username, password);
      const user = await getCurrentUser(tokens.access_token);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        accessToken: tokens.access_token,
      });
    } catch (error) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        accessToken: null,
      });
      throw error;
    }
  };

  const logout = async () => {
    await tiledLogout();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
