'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { DatasetItem } from '@/lib/tiled/types';
import { TiledWebSocket, createTiledWebSocket, WEBSOCKETS_ENABLED } from '@/lib/tiled/websocket';

interface UseTiledSubscriptionOptions {
  enabled?: boolean;
  includeHistory?: boolean;
  pollingInterval?: number; // ms, used as fallback
}

interface UseTiledSubscriptionReturn {
  isConnected: boolean;
  reconnectAttempts: number;
  mode: 'websocket' | 'polling' | 'disconnected';
}

export function useTiledSubscription(
  path: string,
  onNewItem: (item: DatasetItem) => void,
  options: UseTiledSubscriptionOptions = {}
): UseTiledSubscriptionReturn {
  const { enabled = true, includeHistory = false, pollingInterval = 5000 } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [mode, setMode] = useState<'websocket' | 'polling' | 'disconnected'>('disconnected');

  const wsRef = useRef<TiledWebSocket | null>(null);
  const onNewItemRef = useRef(onNewItem);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstPollRef = useRef(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const usePollingRef = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    onNewItemRef.current = onNewItem;
  }, [onNewItem]);

  // Polling function
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return; // Already polling

    const poll = async () => {
      try {
        const { listChildren } = await import('@/lib/tiled/client');
        const result = await listChildren(path, { limit: 10, sort: '-time_created' });

        // On first poll, just record known IDs
        if (isFirstPollRef.current) {
          result.items.forEach((item) => knownIdsRef.current.add(item.id));
          isFirstPollRef.current = false;
          setIsConnected(true);
          setMode('polling');
          return;
        }

        // Check for new items
        for (const item of result.items) {
          if (!knownIdsRef.current.has(item.id)) {
            knownIdsRef.current.add(item.id);
            onNewItemRef.current({ ...item, isNew: true });
          }
        }

        setIsConnected(true);
        setMode('polling');
      } catch (error) {
        console.error('Polling error:', error);
        setIsConnected(false);
        setMode('disconnected');
      }
    };

    // Initial poll
    poll();

    // Set up interval
    pollingIntervalRef.current = setInterval(poll, pollingInterval);
  }, [path, pollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    isFirstPollRef.current = true;
    knownIdsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!enabled || !path) return;

    // If WebSockets are disabled, go straight to polling
    if (!WEBSOCKETS_ENABLED) {
      console.log('[Subscription] WebSockets disabled, using polling');
      usePollingRef.current = true;
      startPolling();
      return () => {
        stopPolling();
      };
    }

    // Try WebSocket first
    const ws = createTiledWebSocket(path, {
      onMessage: (item) => {
        onNewItemRef.current(item);
      },
      onConnect: () => {
        console.log('[Subscription] WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        setMode('websocket');
        stopPolling(); // Stop polling if we connect
        usePollingRef.current = false;
      },
      onDisconnect: () => {
        setIsConnected(false);
        setReconnectAttempts((prev) => prev + 1);
      },
      onError: () => {
        setIsConnected(false);
      },
      onMaxReconnectReached: () => {
        // Fall back to polling when WebSocket fails
        console.log('[Subscription] WebSocket failed, falling back to polling');
        usePollingRef.current = true;
        startPolling();
      },
      includeHistory,
    });

    wsRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
      wsRef.current = null;
      stopPolling();
    };
  }, [path, enabled, includeHistory, startPolling, stopPolling]);

  return { isConnected, reconnectAttempts, mode };
}

export function useInfiniteScrollWithWebSocket(
  path: string,
  options: {
    pageSize?: number;
    sort?: string;
    enabled?: boolean;
  } = {}
) {
  const { pageSize = 20, sort = '-time_created', enabled = true } = options;

  const [items, setItems] = useState<DatasetItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const loadItems = useCallback(async (loadOffset: number = 0) => {
    if (!enabled || !path) return;

    setIsLoading(true);
    setError(null);

    try {
      const { listChildren } = await import('@/lib/tiled/client');
      const result = await listChildren(path, {
        offset: loadOffset,
        limit: pageSize,
        sort,
      });

      if (loadOffset === 0) {
        setItems(result.items);
      } else {
        setItems((prev) => [...prev, ...result.items]);
      }

      setHasMore(result.hasMore);
      setOffset(loadOffset + result.items.length);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load items'));
    } finally {
      setIsLoading(false);
      setIsInitialLoad(false);
    }
  }, [path, pageSize, sort, enabled]);

  // Initial load
  useEffect(() => {
    if (enabled && path) {
      loadItems(0);
    }
  }, [enabled, path, loadItems]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadItems(offset);
    }
  }, [isLoading, hasMore, offset, loadItems]);

  const reset = useCallback(() => {
    setItems([]);
    setOffset(0);
    setHasMore(true);
    setIsInitialLoad(true);
    loadItems(0);
  }, [loadItems]);

  // Handle new items from WebSocket
  const handleNewItem = useCallback((newItem: DatasetItem) => {
    setItems((prev) => {
      // Check if item already exists
      if (prev.some((item) => item.id === newItem.id)) {
        return prev;
      }
      return [{ ...newItem, isNew: true }, ...prev];
    });

    // Remove isNew flag after animation
    setTimeout(() => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === newItem.id ? { ...item, isNew: false } : item
        )
      );
    }, 3000);
  }, []);

  const { isConnected, reconnectAttempts, mode } = useTiledSubscription(
    path,
    handleNewItem,
    { enabled }
  );

  return {
    items,
    isLoading,
    isInitialLoad,
    hasMore,
    error,
    loadMore,
    reset,
    isConnected,
    reconnectAttempts,
    mode,
  };
}
