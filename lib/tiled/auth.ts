import { TokenResponse, TiledUser } from './types';

const TOKEN_KEY = 'tiled_access_token';
const REFRESH_TOKEN_KEY = 'tiled_refresh_token';
const TOKEN_EXPIRY_KEY = 'tiled_token_expiry';

export function getStoredTokens(): { accessToken: string | null; refreshToken: string | null; expiresAt: number | null } {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null, expiresAt: null };
  }

  return {
    accessToken: localStorage.getItem(TOKEN_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
    expiresAt: localStorage.getItem(TOKEN_EXPIRY_KEY) ? parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY)!) : null,
  };
}

export function storeTokens(response: TokenResponse): void {
  if (typeof window === 'undefined') return;

  const expiresAt = Date.now() + response.expires_in * 1000;
  localStorage.setItem(TOKEN_KEY, response.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

export function isTokenExpired(): boolean {
  const { expiresAt } = getStoredTokens();
  if (!expiresAt) return true;
  // Consider expired 1 minute before actual expiry
  return Date.now() > expiresAt - 60000;
}

export async function loginWithPassword(username: string, password: string): Promise<TokenResponse> {
  // Use local API route to avoid CORS issues
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  storeTokens(data);
  return data;
}

export async function refreshAccessToken(): Promise<TokenResponse | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  try {
    // Use local API route to avoid CORS issues
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data: TokenResponse = await response.json();
    storeTokens(data);
    return data;
  } catch {
    clearTokens();
    return null;
  }
}

export async function getCurrentUser(accessToken: string): Promise<TiledUser | null> {
  try {
    // Use local API route to avoid CORS issues
    const response = await fetch('/api/auth/whoami', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  // Just clear tokens locally - no need to call server
  clearTokens();
}

export async function getValidAccessToken(): Promise<string | null> {
  const { accessToken } = getStoredTokens();

  if (!accessToken) return null;

  if (isTokenExpired()) {
    const refreshed = await refreshAccessToken();
    return refreshed?.access_token || null;
  }

  return accessToken;
}
