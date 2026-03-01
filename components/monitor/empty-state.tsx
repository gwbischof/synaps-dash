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
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6"
    >
      {/* Icon with glow */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative mb-8"
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 w-24 h-24 -m-6 rounded-full bg-beam/10 blur-2xl animate-breathe" />

        {/* Icon container */}
        <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl glass-card">
          <Layers className="w-7 h-7 text-beam" />
        </div>
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="max-w-md mb-8"
      >
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          No monitors active
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Add a monitor to start tracking datasets from the Tiled server.
          New data will stream in real-time as experiments run.
        </p>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <Button
          onClick={onAddMonitor}
          className="h-11 px-6 bg-beam text-surface-ground hover:bg-beam/90 font-medium rounded-xl gap-2 beam-caustic"
        >
          <Plus className="w-4 h-4" />
          Add Monitor
        </Button>
      </motion.div>

      {/* Hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-8 text-xs text-text-tertiary max-w-sm"
      >
        Try monitoring{' '}
        <code className="text-beam bg-beam/10 px-1.5 py-0.5 rounded font-mono">
          tst/sandbox/synaps/reconstructions
        </code>
      </motion.p>
    </motion.div>
  );
}
