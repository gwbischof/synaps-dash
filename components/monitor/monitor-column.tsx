'use client';

import { useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wifi, WifiOff, ChevronUp, Loader2 } from 'lucide-react';
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
  id,
  path,
  label,
  onRemove,
  onSelectItem,
}: MonitorColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
  } = useInfiniteScrollWithWebSocket(path);

  // Infinite scroll observer
  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isLoading, hasMore, loadMore]
  );

  // Handle scroll for back to top button
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setShowBackToTop(target.scrollTop > 300);
  }, []);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col w-80 h-full bg-chamber/50 border border-border-subtle rounded-lg backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm tracking-wider text-text-primary truncate">
              {label.toUpperCase()}
            </h3>
            {isConnected ? (
              <Wifi className="h-3 w-3 text-status-complete flex-shrink-0" />
            ) : (
              <WifiOff className="h-3 w-3 text-text-dim flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-text-dim font-mono truncate">{path}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-6 w-6 text-text-dim hover:text-status-error hover:bg-status-error/10"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <p className="text-status-error text-sm mb-2">Failed to load</p>
              <p className="text-text-dim text-xs">{error.message}</p>
            </div>
          </div>
        ) : isInitialLoad ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 text-beam-cyan animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center">
              <p className="text-text-secondary text-sm mb-1">No datasets yet</p>
              <p className="text-text-dim text-xs">
                New items will appear here in real-time
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea
            className="h-full"
            ref={scrollRef}
            onScrollCapture={handleScroll}
          >
            <div className="p-3 space-y-3">
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

              {/* Loading more indicator */}
              {isLoading && !isInitialLoad && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 text-beam-cyan animate-spin" />
                </div>
              )}

              {/* End of list */}
              {!hasMore && items.length > 0 && (
                <div className="text-center py-4">
                  <p className="text-text-dim text-xs">End of list</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Back to top button */}
        <AnimatePresence>
          {showBackToTop && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-4 right-4"
            >
              <Button
                size="icon"
                onClick={scrollToTop}
                className={cn(
                  'h-8 w-8 rounded-full bg-beam-cyan text-void',
                  'hover:bg-beam-cyan-bright shadow-lg shadow-beam-cyan/20'
                )}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer stats */}
      <div className="px-4 py-2 border-t border-border-subtle">
        <div className="flex items-center justify-between text-xs text-text-dim">
          <span>{items.length} items loaded</span>
          <span className={cn(
            'flex items-center gap-1',
            isConnected ? 'text-status-complete' : 'text-text-dim'
          )}>
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              isConnected ? 'bg-status-complete animate-status-pulse' : 'bg-text-dim'
            )} />
            {isConnected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
