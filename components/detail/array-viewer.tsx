'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchThumbnail } from '@/lib/tiled/client';

interface ArrayViewerProps {
  path: string;
}

export function ArrayViewer({ path }: ArrayViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = await fetchThumbnail(path);
        if (!cancelled) {
          setImageUrl(url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load image');
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
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [path]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-chamber rounded-lg border border-border-subtle">
        <Loader2 className="h-8 w-8 text-beam-cyan animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 bg-chamber rounded-lg border border-border-subtle">
        <div className="text-center">
          <p className="text-status-error text-sm mb-1">Failed to load image</p>
          <p className="text-text-dim text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-64 bg-chamber rounded-lg border border-border-subtle">
        <p className="text-text-dim text-sm">No image available</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-chamber">
      <img
        src={imageUrl}
        alt="Array visualization"
        className="w-full h-auto max-h-96 object-contain"
      />
      {/* Vignette overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-chamber/50 via-transparent to-transparent" />
    </div>
  );
}
