'use client';

import { useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wifi, WifiOff, Loader2, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DatasetCard } from './dataset-card';
import { useInfiniteScrollWithWebSocket } from '@/hooks/use-tiled-subscription';
import { DatasetItem } from '@/lib/tiled/types';
import { cn } from '@/lib/utils';

interface MonitorColumnProps {
  id: string;
  path: string;
  label: string;
  onRemove: () => void;
  onSelectItem: (item: DatasetItem) => void;
}

export function MonitorColumn({
  id: _id,
  path,
  label,
  onRemove,
  onSelectItem,
}: MonitorColumnProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const {
    items,
    isLoading,
    isInitialLoad,
    hasMore,
    error,
    loadMore,
    isConnected,
    mode,
  } = useInfiniteScrollWithWebSocket(path);

  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isLoading, hasMore, loadMore]
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setShowBackToTop(target.scrollTop > 200);
  }, []);

  const scrollToTop = useCallback(() => {
    viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col w-80 h-full flex-shrink-0 glass-card rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {label}
            </h3>
            {isConnected ? (
              <Wifi className="w-3 h-3 text-live flex-shrink-0" />
            ) : (
              <WifiOff className="w-3 h-3 text-text-tertiary flex-shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-text-tertiary font-mono truncate">{path}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-7 w-7 text-text-tertiary hover:text-error hover:bg-error/10 rounded-lg flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Back to Top */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onClick={scrollToTop}
            className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-beam bg-beam/5 border-b border-beam/20 hover:bg-beam/10 transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
            Back to top
          </motion.button>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center">
              <p className="text-error text-sm font-medium mb-1">Failed to load</p>
              <p className="text-text-tertiary text-xs">{error.message}</p>
            </div>
          </div>
        ) : isInitialLoad ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 text-beam animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center">
              <p className="text-text-secondary text-sm mb-1">No datasets yet</p>
              <p className="text-text-tertiary text-xs">
                Waiting for new data...
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea
            className="h-full"
            viewportRef={viewportRef}
            onScrollCapture={handleScroll}
          >
            <div className="p-3 space-y-2">
              <AnimatePresence mode="popLayout">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    ref={index === items.length - 1 ? lastItemRef : null}
                  >
                    <DatasetCard
                      item={item}
                      onClick={() => onSelectItem(item)}
                    />
                  </div>
                ))}
              </AnimatePresence>

              {isLoading && !isInitialLoad && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 text-beam animate-spin" />
                </div>
              )}

              {!hasMore && items.length > 0 && (
                <p className="text-center py-3 text-[11px] text-text-tertiary">
                  End of list
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border-subtle bg-surface-ground/50">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-tertiary font-mono">{items.length} items</span>
          <span className={cn(
            'flex items-center gap-1.5',
            isConnected ? 'text-live' : 'text-text-tertiary'
          )}>
            <span className={cn(
              'status-dot',
              isConnected ? 'status-dot-live animate-pulse-live' : 'bg-text-tertiary'
            )} />
            {isConnected
              ? mode === 'websocket' ? 'Live' : 'Polling'
              : 'Offline'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
