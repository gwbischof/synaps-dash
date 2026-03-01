'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { DatasetItem } from '@/lib/tiled/types';
import { TiledWebSocket, createTiledWebSocket } from '@/lib/tiled/websocket';

interface UseTiledSubscriptionOptions {
  enabled?: boolean;
  includeHistory?: boolean;
}

interface UseTiledSubscriptionReturn {
  isConnected: boolean;
  reconnectAttempts: number;
}

export function useTiledSubscription(
  path: string,
  onNewItem: (item: DatasetItem) => void,
  options: UseTiledSubscriptionOptions = {}
): UseTiledSubscriptionReturn {
  const { enabled = true, includeHistory = false } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<TiledWebSocket | null>(null);
  const onNewItemRef = useRef(onNewItem);

  // Keep callback ref updated
  useEffect(() => {
    onNewItemRef.current = onNewItem;
  }, [onNewItem]);

  useEffect(() => {
    if (!enabled || !path) return;

    const ws = createTiledWebSocket(path, {
      onMessage: (item) => {
        onNewItemRef.current(item);
      },
      onConnect: () => {
        setIsConnected(true);
        setReconnectAttempts(0);
      },
      onDisconnect: () => {
        setIsConnected(false);
        setReconnectAttempts((prev) => prev + 1);
      },
      onError: () => {
        setIsConnected(false);
      },
      includeHistory,
    });

    wsRef.current = ws;
    ws.connect();

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [path, enabled, includeHistory]);

  return { isConnected, reconnectAttempts };
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

  const { isConnected, reconnectAttempts } = useTiledSubscription(
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
  };
}
