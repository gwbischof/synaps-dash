'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { downloadSvg } from '@/lib/tiled/client';

interface SvgExportButtonProps {
  path: string;
  filename?: string;
}

export function SvgExportButton({ path, filename }: SvgExportButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const defaultFilename = `${path.split('/').pop() || 'export'}.svg`;
      await downloadSvg(path, filename || defaultFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        onClick={handleDownload}
        disabled={isDownloading}
        variant="outline"
        className="w-full border-cell text-cell hover:bg-cell/10"
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Download SVG
      </Button>
      {error && (
        <p className="text-xs text-error">{error}</p>
      )}
    </div>
  );
}
