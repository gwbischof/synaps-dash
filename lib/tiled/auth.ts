import { TokenResponse, TiledUser } from './types';

const TOKEN_KEY = 'tiled_access_token';
const REFRESH_TOKEN_KEY = 'tiled_refresh_token';
const TOKEN_EXPIRY_KEY = 'tiled_token_expiry';
const API_KEY_KEY = 'tiled_api_key';
const AUTH_TYPE_KEY = 'tiled_auth_type';

type AuthType = 'token' | 'apikey';

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

export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(API_KEY_KEY);
}

export function getAuthType(): AuthType | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TYPE_KEY) as AuthType | null;
}

export function storeTokens(response: TokenResponse): void {
  if (typeof window === 'undefined') return;

  const expiresAt = Date.now() + response.expires_in * 1000;
  localStorage.setItem(TOKEN_KEY, response.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
  localStorage.setItem(AUTH_TYPE_KEY, 'token');
  localStorage.removeItem(API_KEY_KEY);
}

export function storeApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(API_KEY_KEY, apiKey);
  localStorage.setItem(AUTH_TYPE_KEY, 'apikey');
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(API_KEY_KEY);
  localStorage.removeItem(AUTH_TYPE_KEY);
}

export function isTokenExpired(): boolean {
  const { expiresAt } = getStoredTokens();
  if (!expiresAt) return true;
  // Consider expired 2 minutes before actual expiry to allow time for refresh
  // (Token lifetime is only 15 minutes, so we can't use a large buffer)
  return Date.now() > expiresAt - 2 * 60 * 1000;
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

export async function validateApiKey(apiKey: string): Promise<TiledUser> {
  // Validate API key by calling whoami
  const response = await fetch('/api/auth/whoami', {
    headers: {
      'Authorization': `Apikey ${apiKey}`,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Invalid API key');
  }

  const user = await response.json();
  storeApiKey(apiKey);
  return user;
}

export async function refreshAccessToken(retries = 2): Promise<TokenResponse | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Use local API route to avoid CORS issues
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (response.ok) {
        const data: TokenResponse = await response.json();
        storeTokens(data);
        return data;
      }

      // Only clear tokens on auth errors (401/403), not network issues
      if (response.status === 401 || response.status === 403) {
        clearTokens();
        return null;
      }

      // For other errors, retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    } catch {
      // Network error - retry if attempts remaining
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  // All retries exhausted but don't clear tokens - might be temporary network issue
  return null;
}

export async function getCurrentUser(accessTokenOrApiKey: string): Promise<TiledUser | null> {
  try {
    const authType = getAuthType();
    const authHeader = authType === 'apikey'
      ? `Apikey ${accessTokenOrApiKey}`
      : `Bearer ${accessTokenOrApiKey}`;

    // Use local API route to avoid CORS issues
    const response = await fetch('/api/auth/whoami', {
      headers: {
        'Authorization': authHeader,
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
  const authType = getAuthType();

  // If using API key, return it directly (they don't expire)
  if (authType === 'apikey') {
    return getStoredApiKey();
  }

  // Token-based auth
  const { accessToken } = getStoredTokens();

  if (!accessToken) return null;

  if (isTokenExpired()) {
    const refreshed = await refreshAccessToken();
    return refreshed?.access_token || null;
  }

  return accessToken;
}

export function getAuthHeader(): string | null {
  const authType = getAuthType();

  if (authType === 'apikey') {
    const apiKey = getStoredApiKey();
    return apiKey ? `Apikey ${apiKey}` : null;
  }

  const { accessToken } = getStoredTokens();
  return accessToken ? `Bearer ${accessToken}` : null;
}
