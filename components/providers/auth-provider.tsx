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
} from '@/lib/tiled/auth';

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

  // Periodic token refresh and validation (only for token auth, not API keys)
  useEffect(() => {
    if (!state.isAuthenticated) return;
    if (getAuthType() === 'apikey') return; // API keys don't expire

    // Check and refresh token periodically (every 5 minutes)
    const checkAndRefresh = async () => {
      if (isTokenExpired()) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          checkAuth();
        }
      }
    };

    // Check every 10 minutes as a fallback (visibility change handles most cases)
    const interval = setInterval(checkAndRefresh, 10 * 60 * 1000);

    // Also check when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Schedule refresh before expiry (tokens only last 15 minutes)
    const { expiresAt } = getStoredTokens();
    let timeout: NodeJS.Timeout | null = null;
    if (expiresAt) {
      const refreshIn = expiresAt - Date.now() - 3 * 60 * 1000; // 3 minutes before expiry
      if (refreshIn > 0) {
        timeout = setTimeout(async () => {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            checkAuth();
          }
        }, refreshIn);
      } else {
        // Token is about to expire, refresh immediately
        refreshAccessToken().then(refreshed => {
          if (refreshed) checkAuth();
        });
      }
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeout) clearTimeout(timeout);
    };
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
