import { WebSocketMessage, DatasetItem } from './types';
import { getValidAccessToken, getAuthType } from './auth';

const TILED_URL = process.env.NEXT_PUBLIC_TILED_URL || 'https://tiled.nsls2.bnl.gov';

export interface WebSocketOptions {
  onMessage: (item: DatasetItem) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onMaxReconnectReached?: () => void;
  includeHistory?: boolean;
}

export class TiledWebSocket {
  private ws: WebSocket | null = null;
  private path: string;
  private options: WebSocketOptions;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3; // Fail fast and fall back to polling
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isManualClose = false;

  constructor(path: string, options: WebSocketOptions) {
    this.path = path;
    this.options = options;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const token = await getValidAccessToken();
    const authType = getAuthType();
    const wsUrl = TILED_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    let url = `${wsUrl}/api/v1/stream/single/${this.path}`;

    if (this.options.includeHistory) {
      url += '?start=0';
    }

    // Add auth - API keys use 'api_key' param, tokens use 'access_token'
    if (token) {
      const paramName = authType === 'apikey' ? 'api_key' : 'access_token';
      const encodedToken = encodeURIComponent(token);
      url += `${url.includes('?') ? '&' : '?'}${paramName}=${encodedToken}`;
    }

    console.log('[WebSocket] Connecting to:', url.replace(/[?&](api_key|access_token)=[^&]+/, '?$1=***'));
    console.log('[WebSocket] Auth type:', authType);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      this.reconnectAttempts = 0;
      this.options.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      console.log('[WebSocket] Message received:', event.data.substring(0, 200));
      try {
        const msg: WebSocketMessage = JSON.parse(event.data);

        if (msg.type === 'container-child-created') {
          const item: DatasetItem = {
            id: msg.key,
            path: `${this.path}/${msg.key}`,
            metadata: msg.metadata,
            structureFamily: msg.structure_family,
            timeCreated: msg.timestamp,
            isNew: true,
          };
          this.options.onMessage(item);
        }
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Closed:', { code: event.code, reason: event.reason, wasClean: event.wasClean });
      if (!this.isManualClose) {
        this.options.onDisconnect?.();
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.options.onError?.(error);
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached, triggering fallback');
      this.options.onMaxReconnectReached?.();
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.isManualClose = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export function createTiledWebSocket(path: string, options: WebSocketOptions): TiledWebSocket {
  return new TiledWebSocket(path, options);
}
