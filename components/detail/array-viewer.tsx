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
        if (!cancelled) setImageUrl(url);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load image');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [path]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-surface-raised border border-border-subtle">
        <div className="text-center">
          <Loader2 className="h-6 w-6 text-beam animate-spin mx-auto mb-2" />
          <p className="text-xs text-text-tertiary">Loading image...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-surface-raised border border-border-subtle">
        <div className="text-center p-6">
          <p className="text-error text-sm font-medium mb-1">Failed to load image</p>
          <p className="text-text-tertiary text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-surface-raised border border-border-subtle">
        <p className="text-text-tertiary text-sm">No image available</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-border-subtle bg-surface-ground">
      <img
        src={imageUrl}
        alt="Array visualization"
        className="w-full h-auto max-h-96 object-contain"
      />
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-surface-ground/30 via-transparent to-transparent" />
    </div>
  );
}
