'use client';

import { motion } from 'framer-motion';
import { DatasetItem } from '@/lib/tiled/types';
import { useTiledThumbnail } from '@/hooks/use-tiled-array';
import { cn } from '@/lib/utils';
import { Hexagon, Layers, Activity, Clock, Microscope, Grid3X3, Table, Database } from 'lucide-react';

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

function findScanId(metadata: Record<string, unknown>): number | string | undefined {
  if (!metadata) return undefined;

  // Direct scan_id at top level
  if (metadata.scan_id !== undefined) return metadata.scan_id as number | string;

  // Try various nested locations
  const nestedKeys = ['start', 'start_doc', 'summary', 'scan', 'attrs', 'attributes', 'meta'];
  for (const key of nestedKeys) {
    if (metadata[key] && typeof metadata[key] === 'object') {
      const nested = metadata[key] as Record<string, unknown>;
      if (nested.scan_id !== undefined) return nested.scan_id as number | string;
      if (nested.id !== undefined && key === 'scan') return nested.id as number | string;
    }
  }

  // Check for scan_id in any top-level object
  for (const [key, value] of Object.entries(metadata)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      if (nested.scan_id !== undefined) return nested.scan_id as number | string;
    }
  }

  // Check parent metadata
  if (metadata.parent && typeof metadata.parent === 'object') {
    return findScanId(metadata.parent as Record<string, unknown>);
  }

  return undefined;
}

function formatRelativeTime(timestamp: string | number | undefined): string {
  if (!timestamp) return '';

  let date: Date;
  if (typeof timestamp === 'number') {
    // Unix timestamp (seconds)
    date = new Date(timestamp * 1000);
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'NOW';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  // Include year in the date format
  const year = date.getFullYear();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}, ${year}`;
}

function findTimestamp(metadata: Record<string, unknown>, itemTimeCreated?: string): string | number | undefined {
  // First check if item already has timeCreated
  if (itemTimeCreated) return itemTimeCreated;

  if (!metadata) return undefined;

  // Common timestamp field names
  const timestampKeys = [
    'time_created',
    'time',
    'timestamp',
    'created_at',
    'creation_time',
    'date',
    'datetime',
    'export_timestamp',
  ];

  // Check top level
  for (const key of timestampKeys) {
    if (metadata[key] !== undefined) {
      return metadata[key] as string | number;
    }
  }

  // Check nested objects
  const nestedKeys = ['start', 'start_doc', 'summary', 'attrs', 'attributes', 'meta'];
  for (const nestedKey of nestedKeys) {
    if (metadata[nestedKey] && typeof metadata[nestedKey] === 'object') {
      const nested = metadata[nestedKey] as Record<string, unknown>;
      for (const key of timestampKeys) {
        if (nested[key] !== undefined) {
          return nested[key] as string | number;
        }
      }
    }
  }

  // Check any top-level object for timestamp fields
  for (const [key, value] of Object.entries(metadata)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      for (const tsKey of timestampKeys) {
        if (nested[tsKey] !== undefined) {
          return nested[tsKey] as string | number;
        }
      }
    }
  }

  return undefined;
}

// Element colors inspired by actual spectroscopy emission colors
const ELEMENT_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  Fe: { bg: 'rgba(255, 140, 0, 0.15)', text: '#ff8c00', glow: 'rgba(255, 140, 0, 0.4)' },
  Cu: { bg: 'rgba(0, 255, 127, 0.15)', text: '#00ff7f', glow: 'rgba(0, 255, 127, 0.4)' },
  Ni: { bg: 'rgba(144, 238, 144, 0.15)', text: '#90ee90', glow: 'rgba(144, 238, 144, 0.4)' },
  Zn: { bg: 'rgba(100, 149, 237, 0.15)', text: '#6495ed', glow: 'rgba(100, 149, 237, 0.4)' },
  Au: { bg: 'rgba(255, 215, 0, 0.15)', text: '#ffd700', glow: 'rgba(255, 215, 0, 0.4)' },
  Ag: { bg: 'rgba(192, 192, 192, 0.15)', text: '#c0c0c0', glow: 'rgba(192, 192, 192, 0.4)' },
  Pt: { bg: 'rgba(229, 228, 226, 0.15)', text: '#e5e4e2', glow: 'rgba(229, 228, 226, 0.4)' },
  Ca: { bg: 'rgba(255, 69, 0, 0.15)', text: '#ff4500', glow: 'rgba(255, 69, 0, 0.4)' },
  K: { bg: 'rgba(238, 130, 238, 0.15)', text: '#ee82ee', glow: 'rgba(238, 130, 238, 0.4)' },
  S: { bg: 'rgba(0, 191, 255, 0.15)', text: '#00bfff', glow: 'rgba(0, 191, 255, 0.4)' },
  P: { bg: 'rgba(255, 182, 193, 0.15)', text: '#ffb6c1', glow: 'rgba(255, 182, 193, 0.4)' },
  Cl: { bg: 'rgba(127, 255, 212, 0.15)', text: '#7fffd4', glow: 'rgba(127, 255, 212, 0.4)' },
};

function getElementStyle(element: string) {
  return ELEMENT_COLORS[element] || {
    bg: 'rgba(0, 229, 255, 0.15)',
    text: '#00e5ff',
    glow: 'rgba(0, 229, 255, 0.4)'
  };
}

// Type indicator config
const TYPE_CONFIG: Record<string, { icon: typeof Layers; label: string; color: string }> = {
  container: { icon: Layers, label: 'DIR', color: 'text-beam-cyan' },
  array: { icon: Grid3X3, label: 'ARR', color: 'text-xray-purple' },
  table: { icon: Table, label: 'TBL', color: 'text-status-processing' },
  BlueskyRun: { icon: Database, label: 'RUN', color: 'text-status-complete' },
};

function getTypeConfig(structureFamily: string, specs?: string[]) {
  // Check specs first for more specific types (like BlueskyRun)
  if (specs?.includes('BlueskyRun')) {
    return TYPE_CONFIG.BlueskyRun;
  }
  return TYPE_CONFIG[structureFamily] || TYPE_CONFIG.array;
}

export function DatasetCard({ item, onClick }: DatasetCardProps) {
  const { thumbnailUrl, isLoading: thumbnailLoading } = useTiledThumbnail(
    item.structureFamily === 'array' ? item.path : null
  );

  const metadata = item.metadata as Record<string, unknown> & {
    element_list?: string[];
    step_size?: number;
    sample?: string;
    precomputed_blobs?: Record<string, Record<string, unknown[]>>;
    groups?: Record<string, { elements?: string[]; processing_mode?: string }>;
  };

  const scanId = findScanId(metadata);
  const sample = metadata.sample;

  // Extract elements from various sources
  let elements: string[] = metadata.element_list || [];
  if (elements.length === 0 && metadata.groups) {
    const groupElements = new Set<string>();
    for (const group of Object.values(metadata.groups)) {
      if (group.elements) group.elements.forEach(el => groupElements.add(el));
    }
    elements = Array.from(groupElements);
  }
  if (elements.length === 0 && metadata.precomputed_blobs) {
    elements = Object.keys(metadata.precomputed_blobs);
  }

  // Count blobs
  let blobCount = 0;
  if (metadata.precomputed_blobs) {
    for (const element of Object.values(metadata.precomputed_blobs)) {
      for (const threshold of Object.values(element)) {
        if (Array.isArray(threshold)) blobCount += threshold.length;
      }
    }
  }

  const groupCount = metadata.groups ? Object.keys(metadata.groups).length : 0;

  // Find timestamp from various sources
  const timestamp = findTimestamp(metadata, item.timeCreated);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden',
        'bg-gradient-to-br from-[#0d1117] via-[#0a0e14] to-[#080b10]',
        'border transition-all duration-300',
        item.isNew
          ? 'border-beam-cyan shadow-[0_0_20px_rgba(0,229,255,0.3),inset_0_1px_0_rgba(0,229,255,0.1)]'
          : 'border-[rgba(255,255,255,0.06)] hover:border-[rgba(0,229,255,0.3)] hover:shadow-[0_0_30px_rgba(0,229,255,0.1)]'
      )}
      style={{
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
      }}
    >
      {/* Scan line effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-beam-cyan/5 via-transparent to-transparent"
             style={{ animation: 'scan-line 2s linear infinite' }} />
      </div>

      {/* Corner accent */}
      <div className="absolute top-0 right-0 w-3 h-3">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-beam-cyan/40 to-transparent" />
      </div>
      <div className="absolute bottom-0 left-0 w-3 h-3">
        <div className="absolute bottom-0 left-0 w-full h-full bg-gradient-to-tr from-beam-cyan/20 to-transparent" />
      </div>

      {/* New item indicator bar */}
      {item.isNew && (
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-beam-cyan to-transparent"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}

      <div className="relative flex gap-3 p-3">
        {/* Thumbnail with technical frame */}
        <div className="relative flex-shrink-0">
          {/* Technical frame corners */}
          <div className="absolute -top-[1px] -left-[1px] w-2 h-2 border-t border-l border-beam-cyan/50" />
          <div className="absolute -top-[1px] -right-[1px] w-2 h-2 border-t border-r border-beam-cyan/50" />
          <div className="absolute -bottom-[1px] -left-[1px] w-2 h-2 border-b border-l border-beam-cyan/50" />
          <div className="absolute -bottom-[1px] -right-[1px] w-2 h-2 border-b border-r border-beam-cyan/50" />

          <div className="relative h-16 w-16 bg-[#050508] overflow-hidden">
            {thumbnailLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <Hexagon className="h-6 w-6 text-beam-cyan/30 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-2 w-2 bg-beam-cyan rounded-full animate-ping" />
                  </div>
                </div>
              </div>
            ) : thumbnailUrl ? (
              <>
                <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050508]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {(() => {
                  const typeConfig = getTypeConfig(item.structureFamily, item.specs);
                  const TypeIcon = typeConfig.icon;
                  return (
                    <>
                      <TypeIcon className={cn('h-5 w-5 opacity-40', typeConfig.color)} />
                      <span className={cn('text-[8px] mt-1 font-mono uppercase tracking-wider opacity-60', typeConfig.color)}>
                        {typeConfig.label}
                      </span>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Status indicator */}
            {item.isNew && (
              <div className="absolute top-1 right-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-beam-cyan opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-beam-cyan" />
                </span>
              </div>
            )}

            {/* Type indicator badge */}
            {(() => {
              const typeConfig = getTypeConfig(item.structureFamily, item.specs);
              const TypeIcon = typeConfig.icon;
              return (
                <div className="absolute bottom-0 left-0 flex items-center gap-0.5 px-1 py-0.5 bg-[#050508]/90 border-t border-r border-[rgba(255,255,255,0.08)]">
                  <TypeIcon className={cn('h-2.5 w-2.5', typeConfig.color)} />
                  <span className={cn('text-[7px] font-mono font-semibold tracking-wider', typeConfig.color)}>
                    {typeConfig.label}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Data readout section */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Primary identifier row */}
          <div className="flex items-center gap-2">
            {scanId !== undefined && (
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] text-beam-cyan/60 font-mono">SCAN</span>
                <span className="font-display text-base text-beam-cyan tracking-wider font-semibold">
                  {scanId}
                </span>
              </div>
            )}
            <span className="font-mono text-[10px] text-text-dim tracking-wide">
              {formatId(item.id)}
            </span>
            {item.isNew && (
              <span className="px-1.5 py-0.5 text-[8px] font-display tracking-widest bg-beam-cyan/20 text-beam-cyan border border-beam-cyan/30 uppercase">
                New
              </span>
            )}
          </div>

          {/* Elements row - styled as spectroscopy readout */}
          {elements.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {elements.slice(0, 5).map((element) => {
                const style = getElementStyle(element);
                return (
                  <span
                    key={element}
                    className="relative px-1.5 py-0.5 text-[10px] font-mono font-semibold tracking-wide"
                    style={{
                      backgroundColor: style.bg,
                      color: style.text,
                      textShadow: `0 0 8px ${style.glow}`,
                    }}
                  >
                    {element}
                  </span>
                );
              })}
              {elements.length > 5 && (
                <span className="text-[10px] text-text-dim font-mono">
                  +{elements.length - 5}
                </span>
              )}
            </div>
          )}

          {/* Metrics row */}
          <div className="flex items-center gap-3 mt-1.5">
            {blobCount > 0 && (
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-xray-purple" />
                <span className="text-[10px] font-mono">
                  <span className="text-xray-purple font-semibold">{blobCount}</span>
                  <span className="text-text-dim ml-0.5">blobs</span>
                </span>
              </div>
            )}
            {groupCount > 0 && (
              <div className="flex items-center gap-1">
                <Hexagon className="h-3 w-3 text-beam-cyan/70" />
                <span className="text-[10px] font-mono">
                  <span className="text-beam-cyan font-semibold">{groupCount}</span>
                  <span className="text-text-dim ml-0.5">{groupCount === 1 ? 'grp' : 'grps'}</span>
                </span>
              </div>
            )}
            {metadata.step_size && (
              <span className="text-[10px] font-mono text-text-dim">
                {metadata.step_size}μm
              </span>
            )}
            {timestamp && (
              <div className="flex items-center gap-1 ml-auto">
                <Clock className="h-2.5 w-2.5 text-text-dim" />
                <span className="text-[10px] font-mono text-text-dim">
                  {formatRelativeTime(timestamp)}
                </span>
              </div>
            )}
          </div>

          {/* Sample name - only if present */}
          {sample && (
            <div className="mt-1 text-[10px] font-mono text-text-secondary truncate">
              <span className="text-text-dim">sample:</span> {sample}
            </div>
          )}
        </div>
      </div>

      {/* Bottom edge glow on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-beam-cyan/0 to-transparent group-hover:via-beam-cyan/50 transition-all duration-300" />
    </motion.div>
  );
}
