'use client';

import { useState, useEffect } from 'react';
import { fetchThumbnail } from '@/lib/tiled/client';

export function useTiledThumbnail(path: string | null) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setThumbnailUrl(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = await fetchThumbnail(path);
        if (!cancelled) {
          setThumbnailUrl(url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load thumbnail'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [path]);

  return { thumbnailUrl, isLoading, error };
}
