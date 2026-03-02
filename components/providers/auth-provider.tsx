'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { TiledUser } from '@/lib/tiled/types';
import {
  getStoredTokens,
  getStoredApiKey,
  getAuthType,
  loginWithPassword,
  validateApiKey,
  logout as tiledLogout,
  getCurrentUser,
  refreshAccessToken,
  isTokenExpired,
  isRefreshTokenExpired,
  getTokenStatus,
} from '@/lib/tiled/auth';
import { onAuthError } from '@/lib/tiled/client';

interface AuthState {
  user: TiledUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  loginWithApiKey: (apiKey: string) => Promise<void>;
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
    const authType = getAuthType();

    // Check API key auth first
    if (authType === 'apikey') {
      const apiKey = getStoredApiKey();
      if (apiKey) {
        const user = await getCurrentUser(apiKey);
        setState({
          user,
          isAuthenticated: !!user,
          isLoading: false,
          accessToken: apiKey,
        });
        return;
      }
    }

    // Token-based auth
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

  // Listen for auth errors from API calls (401 responses)
  useEffect(() => {
    const unsubscribe = onAuthError(() => {
      console.log('[Auth] Auth error received, logging out');
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        accessToken: null,
      });
    });
    return unsubscribe;
  }, []);

  // Refresh token proactively and when tab becomes visible
  useEffect(() => {
    if (!state.isAuthenticated) return;
    if (getAuthType() === 'apikey') return; // API keys don't expire

    // Always try to refresh - don't wait for expiry since refresh tokens may also be short-lived
    const refresh = async (force = false) => {
      const status = getTokenStatus();
      console.log('[Auth] Token status:', {
        accessExpiresIn: `${status.accessExpiresIn}s (${Math.round(status.accessExpiresIn / 60)}min)`,
        refreshExpiresIn: `${status.refreshExpiresIn}s (${Math.round(status.refreshExpiresIn / 60)}min)`,
        accessExpired: status.accessExpired,
        refreshExpired: status.refreshExpired,
      });

      // If refresh token is expired, no point trying
      if (status.refreshExpired) {
        console.log('[Auth] Refresh token expired, cannot refresh');
        return;
      }

      if (force || status.accessExpired) {
        console.log('[Auth] Refreshing token...', { force });
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          console.log('[Auth] Token refreshed successfully');
          checkAuth();
        } else {
          console.log('[Auth] Token refresh failed');
        }
      }
    };

    // Handle visibility change - refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Auth] Tab visible, checking token...');
        refresh(true); // Force refresh when coming back to tab
      }
    };

    // Handle window focus - also catches alt-tab back to browser
    const handleFocus = () => {
      refresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Refresh more aggressively - every 2 minutes to stay ahead of short-lived tokens
    const interval = setInterval(() => refresh(), 2 * 60 * 1000);

    // Also refresh immediately on mount to ensure fresh token
    refresh();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [state.isAuthenticated, checkAuth]);

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

  const loginWithApiKeyFn = async (apiKey: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const user = await validateApiKey(apiKey);

      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        accessToken: apiKey,
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
    <AuthContext.Provider value={{ ...state, login, loginWithApiKey: loginWithApiKeyFn, logout }}>
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
