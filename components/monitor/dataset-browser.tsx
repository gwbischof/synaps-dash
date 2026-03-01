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

const STRUCTURE_STYLES: Record<string, string> = {
  container: 'text-beam bg-beam/10 border-beam/20',
  array: 'text-cell bg-cell/10 border-cell/20',
  table: 'text-warning bg-warning/10 border-warning/20',
  BlueskyRun: 'text-live bg-live/10 border-live/20',
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
      if (authHeader) headers['Authorization'] = authHeader;

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
    if (pathString || !showManualEntry) {
      fetchNodes(pathString);
    }
  }, [pathString, fetchNodes, showManualEntry]);

  const handleManualPathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualPath.trim().replace(/^\/+|\/+$/g, '');
    if (trimmed) {
      setCurrentPath(trimmed.split('/'));
      setShowManualEntry(false);
    }
  };

  const navigateTo = (nodeId: string) => setCurrentPath([...currentPath, nodeId]);

  const navigateUp = () => {
    if (currentPath.length === 1) {
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

  const getIcon = (node: BrowserNode) => {
    if (node.specs.includes('BlueskyRun')) return STRUCTURE_ICONS.BlueskyRun;
    return STRUCTURE_ICONS[node.structureFamily] || Layers;
  };

  const getStyle = (node: BrowserNode) => {
    if (node.specs.includes('BlueskyRun')) return STRUCTURE_STYLES.BlueskyRun;
    return STRUCTURE_STYLES[node.structureFamily] || 'text-text-secondary bg-surface-raised border-border-subtle';
  };

  return (
    <div className="flex flex-col h-[500px] rounded-xl overflow-hidden bg-surface-base border border-border-subtle">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle bg-surface-ground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-beam/10 border border-beam/20 flex items-center justify-center">
              <Database className="w-4 h-4 text-beam" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Data Catalog</h3>
              <p className="text-[10px] text-text-tertiary font-mono">Tiled Server</p>
            </div>
          </div>
          <span className="badge badge-live">Connected</span>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="px-4 py-2 border-b border-border-subtle flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => navigateToBreadcrumb(-1)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
            currentPath.length === 0
              ? 'text-beam bg-beam/10'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
          )}
        >
          <Home className="w-3 h-3" />
          Start
        </button>

        {currentPath.map((segment, index) => (
          <div key={index} className="flex items-center">
            <ChevronRight className="w-3 h-3 text-text-tertiary mx-1" />
            <button
              onClick={() => navigateToBreadcrumb(index)}
              className={cn(
                'px-2 py-1 rounded-md text-xs font-mono transition-colors',
                index === currentPath.length - 1
                  ? 'text-beam bg-beam/10'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
              )}
            >
              {segment}
            </button>
          </div>
        ))}
      </div>

      {/* Path bar */}
      {currentPath.length > 0 && (
        <div className="px-4 py-2 border-b border-border-subtle bg-surface-ground/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={navigateUp}
              className="p-1.5 rounded-md hover:bg-surface-raised transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <code className="text-xs text-text-secondary font-mono truncate">
              /{pathString}
            </code>
          </div>
          <Button
            size="sm"
            onClick={() => onSelect(pathString)}
            className="h-7 px-3 bg-beam text-surface-ground hover:bg-beam/90 text-xs font-medium shrink-0"
          >
            Select
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-3">
            {showManualEntry && currentPath.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-12 h-12 rounded-xl bg-beam/10 border border-beam/20 flex items-center justify-center mb-4">
                  <Database className="w-6 h-6 text-beam" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">Enter Starting Path</h3>
                <p className="text-xs text-text-tertiary text-center mb-4 max-w-xs">
                  Enter a Tiled path to browse, e.g.{' '}
                  <code className="text-beam bg-beam/10 px-1 rounded">tst/sandbox</code>
                </p>
                <form onSubmit={handleManualPathSubmit} className="w-full max-w-sm space-y-3">
                  <Input
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    placeholder="tst/sandbox/synaps"
                    className="bg-surface-ground border-border-subtle focus:border-beam font-mono text-sm"
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!manualPath.trim()}
                      className="flex-1 bg-beam text-surface-ground hover:bg-beam/90"
                    >
                      Browse
                    </Button>
                  </div>
                </form>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-beam animate-spin mb-3" />
                <p className="text-xs text-text-tertiary">Loading...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/20">
                  <p className="text-sm text-error">{error}</p>
                </div>
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Layers className="w-8 h-8 text-text-tertiary mb-2" />
                <p className="text-sm text-text-secondary">Empty</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                <div className="space-y-1">
                  {nodes.map((node, index) => {
                    const Icon = getIcon(node);
                    const style = getStyle(node);
                    const isContainer = node.structureFamily === 'container';
                    const isHovered = hoveredNode === node.id;

                    return (
                      <motion.button
                        key={node.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => isContainer && navigateTo(node.id)}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        disabled={!isContainer}
                        className={cn(
                          'browser-row w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                          isContainer ? 'cursor-pointer' : 'cursor-default opacity-60'
                        )}
                      >
                        <div className={cn('w-8 h-8 rounded-lg border flex items-center justify-center transition-transform', style, isHovered && 'scale-105')}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-sm font-mono truncate transition-colors', isHovered ? 'text-beam' : 'text-text-primary')}>
                              {node.id}
                            </span>
                            {node.specs.length > 0 && (
                              <span className="badge badge-cell">{node.specs[0]}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-text-tertiary font-mono">{node.structureFamily}</span>
                            {node.childCount !== undefined && (
                              <span className="text-[10px] text-text-tertiary">{node.childCount} items</span>
                            )}
                          </div>
                        </div>
                        {isContainer && (
                          <ChevronRight className={cn('w-4 h-4 transition-all', isHovered ? 'text-beam translate-x-0.5' : 'text-text-tertiary')} />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border-subtle bg-surface-ground flex items-center justify-between">
        <span className="text-[10px] text-text-tertiary font-mono">
          {nodes.length} nodes &middot; depth {currentPath.length}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
            Cancel
          </Button>
          {currentPath.length > 0 && (
            <Button
              size="sm"
              onClick={() => onSelect(pathString)}
              className="h-7 bg-beam text-surface-ground hover:bg-beam/90 text-xs"
            >
              Monitor Path
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
