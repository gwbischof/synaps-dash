'use client';

import { motion } from 'framer-motion';
import { Plus, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  onAddMonitor: () => void;
}

export function EmptyState({ onAddMonitor }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-beam-cyan/20 blur-3xl rounded-full" />
        <div className="relative p-8 rounded-2xl bg-chamber/50 border border-border-subtle backdrop-blur-sm">
          <Layers className="h-16 w-16 text-beam-cyan mb-4 mx-auto" />
          <h2 className="text-xl font-display text-text-primary mb-2 tracking-wide">
            NO MONITORS ACTIVE
          </h2>
          <p className="text-text-secondary text-sm max-w-xs mb-6">
            Add a monitor to start tracking datasets from the Tiled server in real-time.
          </p>

          <Button
            onClick={onAddMonitor}
            className="bg-beam-cyan text-void hover:bg-beam-cyan-bright font-display tracking-wider gap-2"
          >
            <Plus className="h-4 w-4" />
            ADD MONITOR
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-text-dim text-xs max-w-md"
      >
        <p>
          Monitors subscribe to Tiled containers and display new datasets as they arrive.
          Try adding{' '}
          <code className="text-beam-cyan bg-elevated px-1 py-0.5 rounded">
            tst/sandbox/synaps/reconstructions
          </code>
        </p>
      </motion.div>
    </motion.div>
  );
}
