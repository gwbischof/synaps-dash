'use client';

import { useState, useEffect } from 'react';
import { fetchThumbnail, fetchDownsampledThumbnail, listChildren, findReconstructionByScanId } from '@/lib/tiled/client';

interface UseTiledThumbnailOptions {
  // Hardcoded subpath to append for thumbnail (e.g., "Ni" for reconstructions)
  subpath?: string;
  // If true, discover the first array child dynamically
  discoverArray?: boolean;
  // If set, look up corresponding reconstruction by scan_id
  findReconstructionByScanId?: string;
  // If true, discover array in BlueskyRun structure (primary/data/{detector})
  discoverBlueskyRun?: boolean;
}

export function useTiledThumbnail(path: string | null, options: UseTiledThumbnailOptions = {}) {
  const { subpath, discoverArray = false, findReconstructionByScanId: scanIdToFind, discoverBlueskyRun = false } = options;
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

        // If scanIdToFind is set, look up corresponding reconstruction
        if (scanIdToFind) {
          const reconstructionArrayPath = await findReconstructionByScanId(path, scanIdToFind);
          if (!reconstructionArrayPath) {
            if (!cancelled) {
              setThumbnailUrl(null);
              setIsLoading(false);
            }
            return;
          }
          targetPath = reconstructionArrayPath;
        }

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

        // If discoverBlueskyRun is true, find array in primary/data/{detector}
        if (discoverBlueskyRun) {
          try {
            // BlueskyRun structure: {run}/primary/data/{detector}
            const primaryDataPath = `${path}/primary/data`;
            // Use empty sort to skip the default sort (which would fail for this path)
            const detectors = await listChildren(primaryDataPath, { limit: 10, sort: '' });
            // Find an array that's actually a 2D image (not 1D data like encoder values)
            const arrays = detectors.items.filter(item => item.structureFamily === 'array');
            // Find arrays with true 2D shape where both dimensions > 1 (actual images)
            const imageArray = arrays.find(a => {
              if (!a.shape || a.shape.length < 2) return false;
              // For 2D: both dims should be > 1
              // For 3D (stack): last two dims should be > 1
              const lastTwo = a.shape.slice(-2);
              return lastTwo[0] > 1 && lastTwo[1] > 1;
            });
            if (imageArray) {
              // Use downsampled fetch for large detector images
              // Pass array dimensions so proper slice syntax is used
              const arrayDims = imageArray.shape?.length || 3;
              const url = await fetchDownsampledThumbnail(imageArray.path, 8, 'viridis', arrayDims);
              if (!cancelled) {
                setThumbnailUrl(url);
                setIsLoading(false);
              }
              return;
            } else {
              // No 2D image found
              if (!cancelled) {
                setThumbnailUrl(null);
                setIsLoading(false);
              }
              return;
            }
          } catch {
            // BlueskyRun structure not found
            if (!cancelled) {
              setThumbnailUrl(null);
              setIsLoading(false);
            }
            return;
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
  }, [path, subpath, discoverArray, scanIdToFind, discoverBlueskyRun]);

  return { thumbnailUrl, isLoading, error };
}
