'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  Database,
  Table2,
  Box,
  ChevronRight,
  Home,
  Loader2,
  Layers,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getAuthHeader } from '@/lib/tiled/auth';

interface BrowserNode {
  id: string;
  structureFamily: 'container' | 'array' | 'table' | string;
  specs: string[];
  childCount?: number;
}

interface DatasetBrowserProps {
  onSelect: (path: string) => void;
  onCancel: () => void;
}

const STRUCTURE_ICONS: Record<string, React.ElementType> = {
  container: Folder,
  array: Box,
  table: Table2,
  BlueskyRun: Database,
};

const STRUCTURE_COLORS: Record<string, string> = {
  container: 'text-beam-cyan border-beam-cyan/30 bg-beam-cyan/5',
  array: 'text-xray-purple border-xray-purple/30 bg-xray-purple/5',
  table: 'text-status-processing border-status-processing/30 bg-status-processing/5',
  BlueskyRun: 'text-status-complete border-status-complete/30 bg-status-complete/5',
};

export function DatasetBrowser({ onSelect, onCancel }: DatasetBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [nodes, setNodes] = useState<BrowserNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [manualPath, setManualPath] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(true);

  const pathString = currentPath.join('/');

  const fetchNodes = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const authHeader = getAuthHeader();
      const url = path
        ? `/api/tiled/search/${path}?page[limit]=100`
        : `/api/tiled/search?page[limit]=100`;

      const headers: HeadersInit = {};
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load directory');
      }

      const data = await response.json();

      const items: BrowserNode[] = data.data.map((node: any) => ({
        id: node.id,
        structureFamily: node.attributes.structure_family,
        specs: node.attributes.specs?.map((s: any) => s.name) || [],
        childCount: node.attributes.structure?.count,
      }));

      setNodes(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setNodes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch if we have a path (don't auto-load root)
    if (pathString || !showManualEntry) {
      fetchNodes(pathString);
    }
  }, [pathString, fetchNodes, showManualEntry]);

  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualPath.trim().replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    if (trimmed) {
      setCurrentPath(trimmed.split('/'));
      setShowManualEntry(false);
    }
  };

  const navigateTo = (nodeId: string) => {
    setCurrentPath([...currentPath, nodeId]);
  };

  const navigateUp = () => {
    if (currentPath.length === 1) {
      // Going back from first level returns to path entry
      setCurrentPath([]);
      setShowManualEntry(true);
      setManualPath('');
    } else {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentPath([]);
      setShowManualEntry(true);
      setManualPath('');
    } else {
      setCurrentPath(currentPath.slice(0, index + 1));
    }
  };

  const handleSelect = () => {
    if (pathString) {
      onSelect(pathString);
    }
  };

  const getIcon = (node: BrowserNode) => {
    // Check specs first for more specific icons
    if (node.specs.includes('BlueskyRun')) {
      return STRUCTURE_ICONS.BlueskyRun;
    }
    return STRUCTURE_ICONS[node.structureFamily] || Layers;
  };

  const getColorClass = (node: BrowserNode) => {
    if (node.specs.includes('BlueskyRun')) {
      return STRUCTURE_COLORS.BlueskyRun;
    }
    return STRUCTURE_COLORS[node.structureFamily] || 'text-text-secondary border-border-subtle bg-elevated';
  };

  return (
    <div className="flex flex-col h-[500px] bg-void rounded-lg overflow-hidden border border-border-subtle">
      {/* Header with beam effect */}
      <div className="relative px-4 py-3 border-b border-border-subtle bg-chamber">
        <div className="absolute inset-0 beam-sweep opacity-50" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-beam-cyan/20 blur-md rounded-full" />
              <div className="relative p-2 bg-beam-cyan/10 rounded-lg border border-beam-cyan/30">
                <Database className="w-4 h-4 text-beam-cyan" />
              </div>
            </div>
            <div>
              <h3 className="font-display text-sm tracking-wider text-beam-cyan">
                DATA CATALOG
              </h3>
              <p className="text-[10px] text-text-dim font-mono">
                TILED SERVER BROWSER
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-text-dim">
            <Zap className="w-3 h-3 text-beam-cyan data-pulse" />
            <span className="font-mono">CONNECTED</span>
          </div>
        </div>
      </div>

      {/* Breadcrumb navigation */}
      <div className="px-4 py-2 border-b border-border-subtle bg-chamber/50">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => navigateToBreadcrumb(-1)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all',
              'hover:bg-beam-cyan/10 hover:text-beam-cyan',
              currentPath.length === 0
                ? 'text-beam-cyan bg-beam-cyan/10'
                : 'text-text-secondary'
            )}
          >
            <Home className="w-3 h-3" />
            <span className="font-mono">START</span>
          </button>

          {currentPath.map((segment, index) => (
            <div key={index} className="flex items-center">
              <ChevronRight className="w-3 h-3 text-text-dim mx-1" />
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className={cn(
                  'px-2 py-1 rounded text-xs font-mono transition-all',
                  'hover:bg-beam-cyan/10 hover:text-beam-cyan',
                  index === currentPath.length - 1
                    ? 'text-beam-cyan bg-beam-cyan/10'
                    : 'text-text-secondary'
                )}
              >
                {segment}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Current path display */}
      {currentPath.length > 0 && (
        <div className="px-4 py-2 border-b border-border-subtle bg-elevated/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={navigateUp}
                className="p-1 rounded hover:bg-beam-cyan/10 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-text-dim hover:text-beam-cyan" />
              </button>
              <code className="text-xs text-text-secondary font-mono bg-void/50 px-2 py-1 rounded">
                /{pathString}
              </code>
            </div>
            <Button
              size="sm"
              onClick={handleSelect}
              className="h-7 px-3 bg-beam-cyan text-void hover:bg-beam-cyan-bright font-display text-xs tracking-wider"
            >
              SELECT THIS PATH
            </Button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-2 grid-pattern">
          {showManualEntry && currentPath.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-beam-cyan/20 blur-xl rounded-full" />
                <div className="relative p-4 bg-beam-cyan/10 rounded-lg border border-beam-cyan/30">
                  <Database className="w-8 h-8 text-beam-cyan" />
                </div>
              </div>
              <h3 className="font-display text-sm tracking-wider text-beam-cyan mb-2">
                ENTER STARTING PATH
              </h3>
              <p className="text-xs text-text-dim text-center mb-6 max-w-xs">
                Enter a Tiled path to begin browsing. Example: <code className="bg-elevated px-1 rounded">tst/sandbox</code>
              </p>
              <form onSubmit={handleManualPathSubmit} className="w-full max-w-sm space-y-3">
                <Input
                  type="text"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  placeholder="e.g., tst/sandbox/synaps"
                  className="bg-elevated border-border-subtle focus:border-beam-cyan font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    className="flex-1 text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={!manualPath.trim()}
                    className="flex-1 bg-beam-cyan text-void hover:bg-beam-cyan-bright font-display tracking-wider"
                  >
                    BROWSE
                  </Button>
                </div>
              </form>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="absolute inset-0 bg-beam-cyan/20 blur-xl rounded-full" />
                <div className="relative p-4 hex-bg bg-beam-cyan/10">
                  <Loader2 className="w-8 h-8 text-beam-cyan hex-spinner" />
                </div>
              </div>
              <p className="mt-4 text-xs text-text-dim font-mono">
                SCANNING DATA STREAMS...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-lg bg-status-error/10 border border-status-error/30">
                <p className="text-sm text-status-error">{error}</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Layers className="w-12 h-12 text-text-dim mb-3" />
              <p className="text-sm text-text-secondary">No items found</p>
              <p className="text-xs text-text-dim mt-1">
                This container is empty
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-1">
                {nodes.map((node, index) => {
                  const Icon = getIcon(node);
                  const colorClass = getColorClass(node);
                  const isContainer = node.structureFamily === 'container';
                  const isHovered = hoveredNode === node.id;

                  return (
                    <motion.div
                      key={node.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <button
                        onClick={() => isContainer && navigateTo(node.id)}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        disabled={!isContainer}
                        className={cn(
                          'browser-row w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                          'text-left transition-all duration-200',
                          isContainer
                            ? 'cursor-pointer hover:pl-4'
                            : 'cursor-default opacity-60'
                        )}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            'type-badge flex items-center justify-center w-8 h-8 rounded-lg border transition-all',
                            colorClass,
                            isHovered && isContainer && 'scale-110'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Name and details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'font-mono text-sm truncate transition-colors',
                                isHovered && isContainer
                                  ? 'text-beam-cyan'
                                  : 'text-text-primary'
                              )}
                            >
                              {node.id}
                            </span>
                            {node.specs.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-xray-purple/10 text-xray-purple border border-xray-purple/20 font-mono">
                                {node.specs[0]}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-text-dim font-mono uppercase">
                              {node.structureFamily}
                            </span>
                            {node.childCount !== undefined && (
                              <>
                                <span className="text-text-dim">•</span>
                                <span className="text-[10px] text-text-dim font-mono">
                                  {node.childCount} items
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Navigate arrow for containers */}
                        {isContainer && (
                          <ChevronRight
                            className={cn(
                              'w-4 h-4 transition-all',
                              isHovered
                                ? 'text-beam-cyan translate-x-1'
                                : 'text-text-dim'
                            )}
                          />
                        )}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-subtle bg-chamber/50">
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-text-dim font-mono">
            {nodes.length} NODES • DEPTH {currentPath.length}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 text-text-secondary hover:text-text-primary"
            >
              Cancel
            </Button>
            {currentPath.length > 0 && (
              <Button
                size="sm"
                onClick={handleSelect}
                className="h-8 bg-beam-cyan text-void hover:bg-beam-cyan-bright font-display tracking-wider"
              >
                MONITOR THIS PATH
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
