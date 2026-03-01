'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrayViewer } from './array-viewer';
import { SvgExportButton } from './svg-export-button';
import { DatasetItem } from '@/lib/tiled/types';
import { cn } from '@/lib/utils';

interface DetailPanelProps {
  item: DatasetItem | null;
  onClose: () => void;
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm text-text-secondary hover:bg-elevated transition-colors"
      >
        <span className="font-medium">{title}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
      className="p-1 text-text-dim hover:text-text-primary transition-colors"
    >
      {copied ? (
        <Check className="h-3 w-3 text-status-complete" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function MetadataRow({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: React.ReactNode;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1">
      <span className="text-xs text-text-dim">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-text-primary text-right font-mono">
          {value}
        </span>
        {copyable && typeof value === 'string' && <CopyButton value={value} />}
      </div>
    </div>
  );
}

export function DetailPanel({ item, onClose }: DetailPanelProps) {
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

  const isArray = item.structureFamily === 'array';

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 h-full w-full max-w-lg bg-chamber border-l border-border-subtle shadow-2xl z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div>
          <h2 className="font-display text-lg text-beam-cyan tracking-wider">
            {metadata.scan_id ? `SCAN #${metadata.scan_id}` : item.id}
          </h2>
          <p className="text-xs text-text-dim font-mono">{item.path}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-text-dim hover:text-text-primary"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-60px)]">
        <div className="p-4 space-y-4">
          {/* Array Viewer */}
          {isArray && (
            <div className="space-y-3">
              <ArrayViewer path={item.path} />
              <SvgExportButton
                path={item.path}
                filename={`${metadata.scan_id || item.id}.svg`}
              />
            </div>
          )}

          <Separator className="bg-border-subtle" />

          {/* Primary Metadata */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Metadata
            </h3>

            <div className="bg-elevated rounded-lg p-3 space-y-1">
              {metadata.scan_id && (
                <MetadataRow
                  label="Scan ID"
                  value={metadata.scan_id.toString()}
                  copyable
                />
              )}
              {metadata.uid && (
                <MetadataRow
                  label="UID"
                  value={metadata.uid.slice(0, 8) + '...'}
                  copyable
                />
              )}
              {item.timeCreated && (
                <MetadataRow
                  label="Created"
                  value={new Date(item.timeCreated).toLocaleString()}
                />
              )}
              {metadata.sample && (
                <MetadataRow label="Sample" value={metadata.sample} copyable />
              )}
              {metadata.project && (
                <MetadataRow label="Project" value={metadata.project} />
              )}
              {metadata.step_size && (
                <MetadataRow
                  label="Step Size"
                  value={`${metadata.step_size} μm`}
                />
              )}
              {item.shape && (
                <MetadataRow
                  label="Dimensions"
                  value={item.shape.join(' × ')}
                />
              )}
            </div>
          </div>

          {/* Elements */}
          {metadata.element_list && metadata.element_list.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Elements
              </h3>
              <div className="flex flex-wrap gap-2">
                {metadata.element_list.map((element) => (
                  <Badge
                    key={element}
                    variant="outline"
                    className="border-beam-cyan text-beam-cyan"
                  >
                    {element}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* ROI Positions */}
          {metadata.roi_positions &&
            Object.keys(metadata.roi_positions).length > 0 && (
              <CollapsibleSection title="ROI Positions">
                <div className="bg-elevated rounded p-2 space-y-1">
                  {Object.entries(metadata.roi_positions).map(([key, value]) => (
                    <MetadataRow
                      key={key}
                      label={key}
                      value={typeof value === 'number' ? value.toFixed(4) : String(value)}
                    />
                  ))}
                </div>
              </CollapsibleSection>
            )}

          {/* Raw Metadata JSON */}
          <CollapsibleSection title="Raw Metadata">
            <pre className="bg-elevated rounded p-3 text-xs text-text-secondary overflow-x-auto font-mono">
              {JSON.stringify(item.metadata, null, 2)}
            </pre>
          </CollapsibleSection>
        </div>
      </ScrollArea>
    </motion.div>
  );
}
