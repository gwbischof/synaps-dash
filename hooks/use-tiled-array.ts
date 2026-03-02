'use client';

import { useState, useEffect } from 'react';
import { fetchThumbnail, listChildren } from '@/lib/tiled/client';

interface UseTiledThumbnailOptions {
  // Hardcoded subpath to append for thumbnail (e.g., "Ni" for reconstructions)
  subpath?: string;
  // If true, discover the first array child dynamically
  discoverArray?: boolean;
}

export function useTiledThumbnail(path: string | null, options: UseTiledThumbnailOptions = {}) {
  const { subpath, discoverArray = false } = options;
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
        let targetPath = subpath ? `${path}/${subpath}` : path;

        // If discoverArray is true, find the first array child
        if (discoverArray) {
          const children = await listChildren(path, { limit: 10 });
          const firstArray = children.items.find(item => item.structureFamily === 'array');
          if (firstArray) {
            targetPath = firstArray.path;
          } else {
            // Try one level deeper
            const firstContainer = children.items.find(item => item.structureFamily === 'container');
            if (firstContainer) {
              const grandchildren = await listChildren(firstContainer.path, { limit: 10 });
              const nestedArray = grandchildren.items.find(item => item.structureFamily === 'array');
              if (nestedArray) {
                targetPath = nestedArray.path;
              } else {
                // No array found
                if (!cancelled) {
                  setThumbnailUrl(null);
                  setIsLoading(false);
                }
                return;
              }
            } else {
              // No array or container found
              if (!cancelled) {
                setThumbnailUrl(null);
                setIsLoading(false);
              }
              return;
            }
          }
        }

        const url = await fetchThumbnail(targetPath);
        if (!cancelled) {
          setThumbnailUrl(url);
        }
      } catch (err) {
        if (!cancelled) {
          setThumbnailUrl(null);
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
  }, [path, subpath, discoverArray]);

  return { thumbnailUrl, isLoading, error };
}
