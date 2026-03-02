'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Copy, Check } from 'lucide-react';
import { downloadImage, getPngUrl } from '@/lib/tiled/client';
import { getAuthHeader } from '@/lib/tiled/auth';

interface ImageExportButtonProps {
  path: string;
  filename?: string;
}

export function SvgExportButton({ path, filename }: ImageExportButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const defaultFilename = `${path.split('/').pop() || 'export'}.png`;
      await downloadImage(path, filename?.replace('.svg', '.png') || defaultFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopy = async () => {
    setIsCopying(true);
    setError(null);

    try {
      const authHeader = getAuthHeader();
      const url = getPngUrl(path);

      const response = await fetch(url, {
        headers: authHeader ? { Authorization: authHeader } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const blob = await response.blob();

      // Use clipboard API to copy image
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copy failed');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          variant="outline"
          className="flex-1 border-cell text-cell hover:bg-cell/10"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download
        </Button>
        <Button
          onClick={handleCopy}
          disabled={isCopying}
          variant="outline"
          className="flex-1 border-beam text-beam hover:bg-beam/10"
        >
          {isCopying ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : copied ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
    </div>
  );
}
