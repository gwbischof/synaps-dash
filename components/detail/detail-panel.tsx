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
    <div className="border border-border-subtle rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm text-text-secondary hover:bg-surface-raised transition-colors"
      >
        <span className="font-medium">{title}</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
            <div className="px-4 pb-4 pt-1">{children}</div>
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
      className="p-1 text-text-tertiary hover:text-text-primary transition-colors rounded hover:bg-surface-raised"
    >
      {copied ? <Check className="h-3 w-3 text-live" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function MetadataRow({ label, value, copyable = false }: { label: string; value: React.ReactNode; copyable?: boolean }) {
  return (
    <div className="data-row">
      <span className="data-label">{label}</span>
      <div className="flex items-center gap-1">
        <span className="data-value">{value}</span>
        {copyable && typeof value === 'string' && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function formatId(id: string): string {
  if (id.includes('-') && id.length > 20) return id.split('-')[0];
  return id;
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
      className="fixed right-0 top-0 h-full w-full max-w-lg glass border-l border-border-subtle z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
        <div>
          <h2 className="text-lg font-semibold text-beam">
            {metadata.scan_id ? `Scan #${metadata.scan_id}` : formatId(item.id)}
          </h2>
          <p className="text-xs text-text-tertiary font-mono mt-0.5">{item.path}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary rounded-lg"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-72px)]">
        <div className="p-5 space-y-5">
          {/* Array Viewer */}
          {isArray && (
            <div className="space-y-3">
              <ArrayViewer path={item.path} />
              <SvgExportButton path={item.path} filename={`${metadata.scan_id || item.id}.svg`} />
            </div>
          )}

          <Separator className="bg-border-subtle" />

          {/* Metadata */}
          <div className="space-y-3">
            <h3 className="data-label">Metadata</h3>
            <div className="bg-surface-raised rounded-xl p-4 border border-border-subtle">
              {metadata.scan_id && <MetadataRow label="Scan ID" value={metadata.scan_id.toString()} copyable />}
              {metadata.uid && <MetadataRow label="UID" value={`${metadata.uid.slice(0, 8)}...`} copyable />}
              {item.timeCreated && <MetadataRow label="Created" value={new Date(item.timeCreated).toLocaleString()} />}
              {metadata.sample && <MetadataRow label="Sample" value={metadata.sample} copyable />}
              {metadata.project && <MetadataRow label="Project" value={metadata.project} />}
              {metadata.step_size && <MetadataRow label="Step Size" value={`${metadata.step_size} µm`} />}
              {item.shape && <MetadataRow label="Dimensions" value={item.shape.join(' × ')} />}
            </div>
          </div>

          {/* Elements */}
          {metadata.element_list && metadata.element_list.length > 0 && (
            <div className="space-y-3">
              <h3 className="data-label">Elements</h3>
              <div className="flex flex-wrap gap-2">
                {metadata.element_list.map((element) => (
                  <Badge key={element} variant="outline" className="border-beam text-beam bg-beam/10">
                    {element}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* ROI Positions */}
          {metadata.roi_positions && Object.keys(metadata.roi_positions).length > 0 && (
            <CollapsibleSection title="ROI Positions">
              <div className="bg-surface-raised rounded-lg p-3 border border-border-subtle">
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

          {/* Raw Metadata */}
          <CollapsibleSection title="Raw Metadata">
            <pre className="bg-surface-ground rounded-lg p-3 text-xs text-text-secondary overflow-x-auto font-mono border border-border-subtle">
              {JSON.stringify(item.metadata, null, 2)}
            </pre>
          </CollapsibleSection>
        </div>
      </ScrollArea>
    </motion.div>
  );
}
