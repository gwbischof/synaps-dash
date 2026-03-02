'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Copy, Check, Layers, Grid3X3, Clock, Hash, Maximize2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrayViewer } from './array-viewer';
import { SvgExportButton } from './svg-export-button';
import { SegmentationPlotButton } from './segmentation-plot';
import { DatasetItem } from '@/lib/tiled/types';
import { listChildren } from '@/lib/tiled/client';

interface DetailPanelProps {
  item: DatasetItem | null;
  onClose: () => void;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ElementType;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <motion.div
      className="rounded-lg overflow-hidden bg-surface-raised/50 border border-border-subtle"
      initial={false}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm hover:bg-surface-overlay/50 transition-colors group"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-text-tertiary group-hover:text-beam transition-colors" />}
          <span className="font-medium text-text-secondary group-hover:text-text-primary transition-colors">{title}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-text-tertiary" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-text-tertiary hover:text-beam transition-all rounded-md hover:bg-beam/10"
    >
      {copied ? <Check className="h-3 w-3 text-live" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function MetadataItem({
  label,
  value,
  copyable = false,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between py-2 group">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3 h-3 text-text-tertiary" />}
        <span className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-mono text-xs text-text-primary">
          {value}
        </span>
        {copyable && typeof value === 'string' && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function ElementBadge({ element }: { element: string }) {
  const colors: Record<string, string> = {
    Fe: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Cu: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Ni: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    Zn: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    Ca: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    K: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    S: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    P: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  };

  const colorClass = colors[element] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-semibold border ${colorClass}`}>
      {element}
    </span>
  );
}

export function DetailPanel({ item, onClose }: DetailPanelProps) {
  const [arrayPath, setArrayPath] = useState<string | null>(null);
  const [arrayShape, setArrayShape] = useState<number[] | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);

  useEffect(() => {
    if (!item) return;

    if (item.structureFamily === 'array') {
      setArrayPath(item.path);
      setArrayShape(item.shape || null);
      return;
    }

    if (item.structureFamily === 'container' && item.path.includes('synaps/reconstructions')) {
      setIsDiscovering(true);
      listChildren(item.path, { limit: 10 })
        .then((result) => {
          const firstArray = result.items.find(child => child.structureFamily === 'array');
          if (firstArray) {
            setArrayPath(firstArray.path);
            setArrayShape(firstArray.shape || null);
          }
        })
        .finally(() => setIsDiscovering(false));
    } else {
      setArrayPath(null);
      setArrayShape(null);
    }
  }, [item]);

  if (!item) return null;

  const metadata = item.metadata as {
    scan_id?: number;
    uid?: string;
    element_list?: string[];
    step_size?: number;
    sample?: string;
    project?: string;
    roi_positions?: Record<string, number>;
    export_timestamp?: number;
    start_doc?: Record<string, unknown>;
    precomputed_blobs?: Record<string, unknown>;
    groups?: Record<string, unknown>;
  };

  const hasViewableArray = arrayPath !== null;
  const numSlices = arrayShape && arrayShape.length === 3 ? arrayShape[0] : undefined;

  return (
    <motion.div
        initial={{ x: '100%', opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0.8 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full max-w-xl z-50 flex flex-col"
      >
        {/* Glass panel container */}
        <div className="h-full m-3 ml-0 rounded-2xl overflow-hidden glass border border-border-medium flex flex-col">

          {/* Header */}
          <div className="flex-shrink-0 px-5 py-4 border-b border-border-subtle bg-surface-base/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Scan ID / Title */}
                <div className="flex items-center gap-3 mb-1">
                  {metadata.scan_id ? (
                    <span className="text-2xl font-semibold text-beam tracking-tight">
                      #{metadata.scan_id}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-text-primary tracking-tight">
                      {item.id.length > 20 ? item.id.slice(0, 8) + '...' : item.id}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-surface-overlay text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
                    {item.structureFamily}
                  </span>
                </div>

                {/* Path */}
                <p className="text-xs text-text-tertiary font-mono truncate opacity-60">
                  {item.path}
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-overlay transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-5">

              {/* Image Viewer */}
              {(hasViewableArray || isDiscovering) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {isDiscovering ? (
                    <div className="flex items-center justify-center h-64 rounded-xl bg-surface-raised border border-border-subtle">
                      <div className="flex items-center gap-3 text-text-tertiary">
                        <div className="w-4 h-4 border-2 border-beam border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Loading image...</span>
                      </div>
                    </div>
                  ) : arrayPath ? (
                    <div className="space-y-3">
                      <ArrayViewer
                        path={arrayPath}
                        metadata={metadata}
                        showScalebar={false}
                        showColorbar={false}
                        numSlices={numSlices}
                      />
                      <div className="flex gap-2">
                        <SvgExportButton path={arrayPath} filename={`${metadata.scan_id || item.id}.svg`} />
                        <SegmentationPlotButton
                          path={arrayPath}
                          metadata={metadata}
                          title={`Segmentation - Scan ${metadata.scan_id || item.id}`}
                        />
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )}

              {/* Quick Stats */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="grid grid-cols-3 gap-3"
              >
                {metadata.scan_id && (
                  <div className="p-3 rounded-lg bg-surface-raised/50 border border-border-subtle">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Hash className="w-3 h-3 text-beam" />
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Scan</span>
                    </div>
                    <span className="text-lg font-semibold text-text-primary font-mono">{metadata.scan_id}</span>
                  </div>
                )}
                {item.shape && (
                  <div className="p-3 rounded-lg bg-surface-raised/50 border border-border-subtle">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Grid3X3 className="w-3 h-3 text-cell" />
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Size</span>
                    </div>
                    <span className="text-lg font-semibold text-text-primary font-mono">{item.shape.join('×')}</span>
                  </div>
                )}
                {item.timeCreated && (
                  <div className="p-3 rounded-lg bg-surface-raised/50 border border-border-subtle">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3 h-3 text-data" />
                      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Created</span>
                    </div>
                    <span className="text-sm font-medium text-text-primary">
                      {new Date(item.timeCreated).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Elements */}
              {metadata.element_list && metadata.element_list.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-3"
                >
                  <h3 className="text-[11px] uppercase tracking-wider text-text-tertiary font-medium">Elements</h3>
                  <div className="flex flex-wrap gap-2">
                    {metadata.element_list.map((element) => (
                      <ElementBadge key={element} element={element} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Metadata Section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <CollapsibleSection title="Metadata" defaultOpen={true} icon={Layers}>
                  <div className="divide-y divide-border-subtle">
                    {metadata.uid && (
                      <MetadataItem label="UID" value={`${metadata.uid.slice(0, 8)}...`} copyable />
                    )}
                    {metadata.sample && (
                      <MetadataItem label="Sample" value={metadata.sample} copyable />
                    )}
                    {metadata.project && (
                      <MetadataItem label="Project" value={metadata.project} />
                    )}
                    {metadata.step_size && (
                      <MetadataItem label="Step Size" value={`${metadata.step_size} µm`} />
                    )}
                    {item.timeCreated && (
                      <MetadataItem label="Created" value={new Date(item.timeCreated).toLocaleString()} icon={Clock} />
                    )}
                  </div>
                </CollapsibleSection>
              </motion.div>

              {/* ROI Positions */}
              {metadata.roi_positions && Object.keys(metadata.roi_positions).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <CollapsibleSection title="ROI Positions" icon={Maximize2}>
                    <div className="divide-y divide-border-subtle">
                      {Object.entries(metadata.roi_positions).map(([key, value]) => (
                        <MetadataItem
                          key={key}
                          label={key}
                          value={typeof value === 'number' ? value.toFixed(4) : String(value)}
                        />
                      ))}
                    </div>
                  </CollapsibleSection>
                </motion.div>
              )}

              {/* Raw Metadata */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <CollapsibleSection title="Raw Data">
                  <pre className="bg-void/50 rounded-lg p-3 text-[11px] text-text-secondary overflow-x-auto font-mono border border-border-subtle max-h-64 overflow-y-auto">
                    {JSON.stringify(item.metadata, null, 2)}
                  </pre>
                </CollapsibleSection>
              </motion.div>

            </div>
          </ScrollArea>
        </div>
      </motion.div>
  );
}
