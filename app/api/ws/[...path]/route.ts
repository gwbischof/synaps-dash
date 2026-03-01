import { WebSocket as NodeWebSocket } from 'ws';

const TILED_URL = process.env.NEXT_PUBLIC_TILED_URL || 'https://tiled.nsls2.bnl.gov';

// Cache API keys by access token to avoid hitting the 100 key limit
const apiKeyCache = new Map<string, { key: string; expiresAt: number }>();

// Create or get cached API key for WebSocket authentication
async function getOrCreateApiKey(accessToken: string): Promise<string | null> {
  // Check cache first
  const cached = apiKeyCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now() + 10000) { // 10s buffer before expiry
    console.log('[WS Proxy] Using cached API key');
    return cached.key;
  }

  try {
    const response = await fetch(`${TILED_URL}/api/v1/auth/apikey`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_in: 1800, // 30 minutes
        scopes: ['read:data', 'read:metadata'],
        note: 'synaps-websocket-proxy',
      }),
    });

    if (!response.ok) {
      console.error('[WS Proxy] Failed to create API key:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    console.log('[WS Proxy] Created new API key');

    // Cache it
    apiKeyCache.set(accessToken, {
      key: data.secret,
      expiresAt: Date.now() + 1800 * 1000, // 30 minutes
    });

    return data.secret;
  } catch (error) {
    console.error('[WS Proxy] Error creating API key:', error);
    return null;
  }
}

export function SOCKET(
  client: import('ws').WebSocket,
  request: import('http').IncomingMessage,
  server: import('ws').WebSocketServer
) {
  const url = new URL(request.url || '', `http://${request.headers.host}`);

  // Extract path from URL (remove /api/ws prefix)
  const pathMatch = url.pathname.match(/^\/api\/ws\/(.+)$/);
  const tiledPath = pathMatch ? pathMatch[1] : '';

  // Get auth token from query params
  const token = url.searchParams.get('token');
  const authType = url.searchParams.get('auth_type') || 'token';

  // Build Tiled WebSocket URL with required params
  const wsUrl = TILED_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  const tiledParams = new URLSearchParams();
  tiledParams.set('envelope_format', 'json');

  const start = url.searchParams.get('start');
  if (start) {
    tiledParams.set('start', start);
  }

  const tiledWsUrl = `${wsUrl}/api/v1/stream/single/${tiledPath}?${tiledParams.toString()}`;

  console.log('[WS Proxy] Client connected, proxying to:', tiledWsUrl);
  console.log('[WS Proxy] Auth type:', authType, 'Token present:', !!token);

  // Connect to Tiled - need to handle async API key creation
  const connectToTiled = async () => {
    let apiKey: string | null = null;

    if (token) {
      if (authType === 'apikey') {
        // Already have an API key, use it directly
        apiKey = token;
        console.log('[WS Proxy] Using provided API key');
      } else {
        // Have a Bearer token, need to get/create API key
        console.log('[WS Proxy] Getting API key from access token...');
        apiKey = await getOrCreateApiKey(token);
        if (!apiKey) {
          client.send(JSON.stringify({ type: 'proxy-error', error: 'Failed to create API key' }));
          client.close(1011, 'Auth error');
          return;
        }
      }
    }

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Apikey ${apiKey}`;
    }

    const tiledWs = new NodeWebSocket(tiledWsUrl, { headers });

    tiledWs.on('open', () => {
      console.log('[WS Proxy] Connected to Tiled');
      client.send(JSON.stringify({ type: 'proxy-connected' }));
    });

    tiledWs.on('message', (data) => {
      if (client.readyState === client.OPEN) {
        client.send(data.toString());
      }
    });

    tiledWs.on('close', (code, reason) => {
      console.log('[WS Proxy] Tiled connection closed:', code, reason.toString());
      if (client.readyState === client.OPEN) {
        client.close(code, reason.toString());
      }
    });

    tiledWs.on('error', (error: Error & { code?: string }) => {
      console.error('[WS Proxy] Tiled connection error:', error.message);
      // Log additional details for debugging
      if (error.message.includes('500')) {
        console.error('[WS Proxy] Server returned 500 - WebSocket streaming may not be enabled for this catalog');
      }
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({
          type: 'proxy-error',
          error: error.message,
          code: error.code,
          recoverable: false
        }));
        client.close(1011, 'Upstream error');
      }
    });

    client.on('message', (data) => {
      if (tiledWs.readyState === tiledWs.OPEN) {
        tiledWs.send(data.toString());
      }
    });

    client.on('close', () => {
      console.log('[WS Proxy] Client disconnected');
      if (tiledWs.readyState === tiledWs.OPEN) {
        tiledWs.close();
      }
    });

    client.on('error', (error) => {
      console.error('[WS Proxy] Client error:', error.message);
      if (tiledWs.readyState === tiledWs.OPEN) {
        tiledWs.close();
      }
    });
  };

  connectToTiled();
}
