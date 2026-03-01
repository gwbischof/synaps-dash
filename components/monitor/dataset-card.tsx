'use client';

import { motion } from 'framer-motion';
import { DatasetItem } from '@/lib/tiled/types';
import { useTiledThumbnail } from '@/hooks/use-tiled-array';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DatasetCardProps {
  item: DatasetItem;
  onClick: () => void;
}

function formatId(id: string): string {
  // If it looks like a UUID, show only the first section
  if (id.includes('-') && id.length > 20) {
    return id.split('-')[0];
  }
  return id;
}

function formatRelativeTime(timestamp: string | undefined): string {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

function getElementColor(element: string): string {
  const colors: Record<string, string> = {
    Fe: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Cu: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    Ni: 'bg-green-500/20 text-green-400 border-green-500/30',
    Zn: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Au: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Ag: 'bg-slate-400/20 text-slate-300 border-slate-400/30',
    Pt: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  return colors[element] || 'bg-beam-cyan/20 text-beam-cyan border-beam-cyan/30';
}

export function DatasetCard({ item, onClick }: DatasetCardProps) {
  const { thumbnailUrl, isLoading: thumbnailLoading } = useTiledThumbnail(
    item.structureFamily === 'array' ? item.path : null
  );

  const metadata = item.metadata as {
    scan_id?: number;
    element_list?: string[];
    step_size?: number;
    sample?: string;
    precomputed_blobs?: Record<string, Record<string, unknown[]>>;
  };

  const scanId = metadata.scan_id;
  const elements = metadata.element_list || [];
  const sample = metadata.sample;

  // Count blobs for segmentation results
  let blobCount = 0;
  if (metadata.precomputed_blobs) {
    for (const element of Object.values(metadata.precomputed_blobs)) {
      for (const threshold of Object.values(element)) {
        if (Array.isArray(threshold)) {
          blobCount += threshold.length;
        }
      }
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-lg bg-elevated border transition-all duration-300',
        item.isNew
          ? 'animate-new-item border-beam-cyan'
          : 'border-border-subtle hover:border-border-glow'
      )}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative h-20 w-20 flex-shrink-0 rounded bg-chamber overflow-hidden">
          {thumbnailLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-4 w-4 border-2 border-beam-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          ) : thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={item.id}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-text-dim text-xs">
              {item.structureFamily === 'container' ? 'DIR' : 'N/A'}
            </div>
          )}

          {/* New indicator */}
          {item.isNew && (
            <div className="absolute top-1 right-1">
              <span className="h-2 w-2 rounded-full bg-beam-cyan animate-status-pulse block" />
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Scan ID */}
          <div className="flex items-center gap-2">
            <span className="font-display text-sm text-text-primary tracking-wide">
              {scanId ? `#${scanId}` : formatId(item.id)}
            </span>
            {item.isNew && (
              <Badge variant="outline" className="text-[10px] py-0 px-1 text-beam-cyan border-beam-cyan">
                NEW
              </Badge>
            )}
          </div>

          {/* Elements */}
          {elements.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {elements.slice(0, 4).map((element) => (
                <Badge
                  key={element}
                  variant="outline"
                  className={cn('text-[10px] py-0 px-1.5 border', getElementColor(element))}
                >
                  {element}
                </Badge>
              ))}
              {elements.length > 4 && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-text-dim">
                  +{elements.length - 4}
                </Badge>
              )}
            </div>
          )}

          {/* Blob count for segmentations */}
          {blobCount > 0 && (
            <div className="text-xs text-text-secondary">
              <span className="text-xray-purple">{blobCount}</span> blobs detected
            </div>
          )}

          {/* Step size */}
          {metadata.step_size && (
            <div className="text-xs text-text-dim">
              {metadata.step_size} μm/px
            </div>
          )}

          {/* Sample name */}
          {sample && (
            <div className="text-xs text-text-dim truncate">{sample}</div>
          )}

          {/* Timestamp */}
          {item.timeCreated && (
            <div className="text-xs text-text-dim">
              {formatRelativeTime(item.timeCreated)}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
