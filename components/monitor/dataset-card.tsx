'use client';

import { motion } from 'framer-motion';
import { DatasetItem } from '@/lib/tiled/types';
import { useTiledThumbnail } from '@/hooks/use-tiled-array';
import { cn } from '@/lib/utils';
import { Layers, Activity, Clock, Grid3X3, Table, Database, Loader2 } from 'lucide-react';

interface DatasetCardProps {
  item: DatasetItem;
  onClick: () => void;
}

function formatId(id: string): string {
  if (id.includes('-') && id.length > 20) {
    return id.split('-')[0];
  }
  return id;
}

function findScanId(metadata: Record<string, unknown>, itemId?: string): number | string | undefined {
  if (!metadata) return undefined;
  if (metadata.scan_id !== undefined) return metadata.scan_id as number | string;

  const nestedKeys = ['start', 'start_doc', 'summary', 'scan', 'attrs', 'attributes', 'meta'];
  for (const key of nestedKeys) {
    if (metadata[key] && typeof metadata[key] === 'object') {
      const nested = metadata[key] as Record<string, unknown>;
      if (nested.scan_id !== undefined) return nested.scan_id as number | string;
    }
  }

  // Try to extract scan_id from item ID (e.g., "automap_392456_xxx" -> 392456)
  if (itemId) {
    const match = itemId.match(/automap_(\d+)_/);
    if (match) return match[1];
  }

  return undefined;
}

function formatRelativeTime(timestamp: string | number | undefined): string {
  if (!timestamp) return '';
  const date = typeof timestamp === 'number' ? new Date(timestamp * 1000) : new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function findTimestamp(metadata: Record<string, unknown>, itemTimeCreated?: string): string | number | undefined {
  if (itemTimeCreated) return itemTimeCreated;
  if (!metadata) return undefined;

  const keys = ['time_created', 'time', 'timestamp', 'created_at', 'export_timestamp'];
  for (const key of keys) {
    if (metadata[key]) return metadata[key] as string | number;
  }
  return undefined;
}

// Element colors - cosmic palette
const ELEMENT_COLORS: Record<string, string> = {
  Fe: '#fbbf24', // Gold - like a star
  Cu: '#4ade80', // Green - life
  Ni: '#a78bfa', // Purple - nebula
  Zn: '#60a5fa', // Blue - stellar
  Au: '#fbbf24', // Gold
  Ca: '#f472b6', // Pink - nova
  K: '#c084fc',  // Violet
  S: '#2dd4bf',  // Teal - beam
  P: '#fb923c',  // Orange
  Cl: '#34d399', // Emerald
};

const getElementColor = (el: string) => ELEMENT_COLORS[el] || '#94a3b8';

const TYPE_CONFIG: Record<string, { icon: typeof Layers; label: string; color: string }> = {
  container: { icon: Layers, label: 'DIR', color: 'text-beam' },
  array: { icon: Grid3X3, label: 'ARR', color: 'text-cell' },
  table: { icon: Table, label: 'TBL', color: 'text-data' },
  BlueskyRun: { icon: Database, label: 'RUN', color: 'text-nebula' },
};

function getTypeConfig(structureFamily: string, specs?: string[]) {
  if (specs?.includes('BlueskyRun')) return TYPE_CONFIG.BlueskyRun;
  return TYPE_CONFIG[structureFamily] || TYPE_CONFIG.array;
}

// Get thumbnail config based on item type
function getThumbnailConfig(
  path: string,
  elements: string[],
  structureFamily: string,
  specs?: string[],
  item?: DatasetItem
): {
  skip: boolean;
  subpath?: string;
  discoverArray?: boolean;
  discoverBlueskyRun?: boolean;
  findReconstructionByScanId?: string;
} {
  // BlueskyRun items: skip thumbnails (tiled server can't render eiger2_image data)
  // The discovery works but tiled returns 500 errors accessing detector data
  if (specs?.includes('BlueskyRun')) {
    return { skip: true };
  }
  // Reconstructions: use first element if available, otherwise discover
  if (path.includes('synaps/reconstructions')) {
    if (elements.length > 0) {
      return { skip: false, subpath: elements[0] };
    }
    return { skip: false, discoverArray: true };
  }
  // Segmentations: show corresponding reconstruction thumbnail
  if (path.includes('synaps/segmentations')) {
    const match = item?.id.match(/automap_(\d+)_/);
    if (match) {
      return { skip: false, findReconstructionByScanId: match[1] };
    }
    return { skip: true };
  }
  // Arrays can be fetched directly
  if (structureFamily === 'array') {
    return { skip: false };
  }
  // Skip other containers
  return { skip: true };
}

export function DatasetCard({ item, onClick }: DatasetCardProps) {
  const metadata = item.metadata as Record<string, unknown> & {
    element_list?: string[];
    step_size?: number;
    sample?: string;
    precomputed_blobs?: Record<string, Record<string, unknown[]>>;
    groups?: Record<string, { elements?: string[] }>;
  };

  const scanId = findScanId(metadata, item.id);

  // Extract elements
  let elements: string[] = metadata.element_list || [];
  if (!elements.length && metadata.groups) {
    const groupElements = new Set<string>();
    Object.values(metadata.groups).forEach(g => g.elements?.forEach(el => groupElements.add(el)));
    elements = Array.from(groupElements);
  }
  if (!elements.length && metadata.precomputed_blobs) {
    elements = Object.keys(metadata.precomputed_blobs);
  }

  // Get thumbnail with hardcoded subpath based on data type
  const thumbnailConfig = getThumbnailConfig(item.path, elements, item.structureFamily, item.specs, item);
  const { thumbnailUrl, isLoading: thumbnailLoading } = useTiledThumbnail(
    thumbnailConfig.skip ? null : item.path,
    {
      subpath: thumbnailConfig.subpath,
      discoverArray: thumbnailConfig.discoverArray,
      findReconstructionByScanId: thumbnailConfig.findReconstructionByScanId,
      discoverBlueskyRun: thumbnailConfig.discoverBlueskyRun,
    }
  );

  // Count blobs
  let blobCount = 0;
  if (metadata.precomputed_blobs) {
    Object.values(metadata.precomputed_blobs).forEach(element => {
      Object.values(element).forEach(threshold => {
        if (Array.isArray(threshold)) blobCount += threshold.length;
      });
    });
  }

  const groupCount = metadata.groups ? Object.keys(metadata.groups).length : 0;
  const timestamp = findTimestamp(metadata, item.timeCreated);
  const typeConfig = getTypeConfig(item.structureFamily, item.specs);
  const TypeIcon = typeConfig.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200',
        'bg-surface-raised border',
        item.isNew
          ? 'border-beam/50 animate-glow-new'
          : 'border-border-subtle hover:border-border-medium'
      )}
    >
      {/* New indicator - cosmic gradient */}
      {item.isNew && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-beam via-nebula to-cell" />
      )}

      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-surface-ground border border-border-subtle">
          {thumbnailLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-text-tertiary animate-spin" />
            </div>
          ) : thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-surface-raised to-surface-ground">
              <TypeIcon className={cn('w-4 h-4', typeConfig.color)} />
              <span className={cn('text-[8px] font-mono font-semibold', typeConfig.color)}>{typeConfig.label}</span>
            </div>
          )}

          {/* Live indicator */}
          {item.isNew && (
            <div className="absolute top-1 right-1">
              <span className="flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-beam animate-ping opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-beam" />
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            {scanId !== undefined && (
              <span className="text-sm font-semibold text-beam">
                #{scanId}
              </span>
            )}
            <span className="text-[10px] text-text-tertiary font-mono truncate">
              {formatId(item.id)}
            </span>
            {item.isNew && (
              <span className="badge badge-beam">NEW</span>
            )}
          </div>

          {/* Elements */}
          {elements.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {elements.slice(0, 4).map(el => (
                <span
                  key={el}
                  className="px-1.5 py-0.5 text-[9px] font-mono font-medium rounded"
                  style={{
                    backgroundColor: `${getElementColor(el)}18`,
                    color: getElementColor(el),
                    border: `1px solid ${getElementColor(el)}35`,
                  }}
                >
                  {el}
                </span>
              ))}
              {elements.length > 4 && (
                <span className="text-[9px] text-text-tertiary">+{elements.length - 4}</span>
              )}
            </div>
          )}

          {/* Metrics */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {blobCount > 0 && (
              <span className="flex items-center gap-1 text-[10px]">
                <Activity className="w-3 h-3 text-nova" />
                <span className="text-text-secondary">{blobCount}</span>
              </span>
            )}
            {groupCount > 0 && (
              <span className="flex items-center gap-1 text-[10px]">
                <Layers className="w-3 h-3 text-cell" />
                <span className="text-text-secondary">{groupCount}</span>
              </span>
            )}
            {timestamp && (
              <span className="flex items-center gap-1 text-[10px] text-text-tertiary ml-auto">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(timestamp)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
