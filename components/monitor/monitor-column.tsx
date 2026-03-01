'use client';

import { useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wifi, WifiOff, Loader2, Zap } from 'lucide-react';
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

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
    const scrolled = target.scrollTop > 150;
    setShowBackToTop(scrolled);

    // Calculate scroll progress for the beam effect
    const maxScroll = target.scrollHeight - target.clientHeight;
    const progress = maxScroll > 0 ? Math.min(target.scrollTop / maxScroll, 1) : 0;
    setScrollProgress(progress);
  }, []);

  const scrollToTop = useCallback(() => {
    viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col w-80 h-full flex-shrink-0 bg-chamber/50 border border-border-subtle rounded-lg backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle relative">
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

      {/* Beam Return - Scroll to Top Indicator */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="overflow-hidden"
          >
            <button
              onClick={scrollToTop}
              className="group w-full relative overflow-hidden"
            >
              {/* Animated beam background */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-beam-cyan/20 to-transparent beam-sweep" />

              {/* Main content */}
              <div className="relative flex items-center justify-center gap-2 px-4 py-2 bg-beam-cyan/5 border-b border-beam-cyan/30 hover:bg-beam-cyan/10 transition-colors">
                {/* Left beam line */}
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-beam-cyan/50 to-beam-cyan" />

                {/* Center icon with glow */}
                <div className="relative">
                  <div className="absolute inset-0 bg-beam-cyan/40 blur-md rounded-full scale-150" />
                  <div className="relative flex items-center gap-1.5 px-3 py-1 bg-beam-cyan/20 rounded-full border border-beam-cyan/40 group-hover:border-beam-cyan group-hover:bg-beam-cyan/30 transition-all">
                    <Zap className="h-3 w-3 text-beam-cyan" />
                    <span className="text-[10px] font-display tracking-widest text-beam-cyan uppercase">
                      Return to top
                    </span>
                  </div>
                </div>

                {/* Right beam line */}
                <div className="flex-1 h-px bg-gradient-to-l from-transparent via-beam-cyan/50 to-beam-cyan" />
              </div>

              {/* Scroll progress indicator */}
              <div className="h-0.5 bg-void/50">
                <motion.div
                  className="h-full bg-gradient-to-r from-beam-cyan via-beam-cyan-bright to-beam-cyan"
                  style={{ width: `${scrollProgress * 100}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
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
            viewportRef={viewportRef}
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
