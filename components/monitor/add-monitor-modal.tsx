'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FolderSearch, Keyboard } from 'lucide-react';
import { DatasetBrowser } from './dataset-browser';
import { cn } from '@/lib/utils';

interface AddMonitorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (path: string) => void;
}

type Mode = 'select' | 'browse' | 'manual';

export function AddMonitorModal({ open, onOpenChange, onAdd }: AddMonitorModalProps) {
  const [mode, setMode] = useState<Mode>('select');
  const [path, setPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (path.trim()) {
      onAdd(path.trim());
      setPath('');
      setMode('select');
      onOpenChange(false);
    }
  };

  const handleBrowserSelect = (selectedPath: string) => {
    onAdd(selectedPath);
    setPath('');
    setMode('select');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setMode('select');
    setPath('');
    onOpenChange(false);
  };

  const handleBack = () => {
    setMode('select');
    setPath('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setMode('select');
        setPath('');
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent
        className={cn(
          'bg-chamber border-border-subtle p-0 gap-0 overflow-hidden',
          mode === 'browse' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        )}
      >
        <AnimatePresence mode="wait">
          {mode === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <DialogHeader className="mb-6">
                <DialogTitle className="font-display text-beam-cyan tracking-wider">
                  ADD DATASET MONITOR
                </DialogTitle>
                <DialogDescription className="text-text-secondary">
                  Choose how you want to select a dataset path to monitor.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3">
                {/* Browse option */}
                <button
                  onClick={() => setMode('browse')}
                  className={cn(
                    'group relative flex items-start gap-4 p-4 rounded-lg',
                    'bg-elevated/50 border border-border-subtle',
                    'hover:border-beam-cyan/50 hover:bg-beam-cyan/5',
                    'transition-all duration-300 text-left'
                  )}
                >
                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 rounded-lg bg-beam-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute inset-0 rounded-lg beam-sweep opacity-0 group-hover:opacity-30" />

                  <div className="relative flex-shrink-0 p-3 rounded-lg bg-beam-cyan/10 border border-beam-cyan/20 group-hover:border-beam-cyan/40 transition-colors">
                    <FolderSearch className="w-5 h-5 text-beam-cyan" />
                  </div>

                  <div className="relative flex-1">
                    <h4 className="font-display text-sm text-text-primary group-hover:text-beam-cyan transition-colors tracking-wide">
                      BROWSE CATALOG
                    </h4>
                    <p className="text-xs text-text-dim mt-1">
                      Navigate through the Tiled data catalog to find and select a container to monitor.
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-mono text-beam-cyan/70 bg-beam-cyan/10 px-2 py-0.5 rounded">
                      RECOMMENDED
                    </span>
                  </div>
                </button>

                {/* Manual entry option */}
                <button
                  onClick={() => setMode('manual')}
                  className={cn(
                    'group relative flex items-start gap-4 p-4 rounded-lg',
                    'bg-elevated/50 border border-border-subtle',
                    'hover:border-xray-purple/50 hover:bg-xray-purple/5',
                    'transition-all duration-300 text-left'
                  )}
                >
                  <div className="absolute inset-0 rounded-lg bg-xray-purple/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative flex-shrink-0 p-3 rounded-lg bg-xray-purple/10 border border-xray-purple/20 group-hover:border-xray-purple/40 transition-colors">
                    <Keyboard className="w-5 h-5 text-xray-purple" />
                  </div>

                  <div className="relative flex-1">
                    <h4 className="font-display text-sm text-text-primary group-hover:text-xray-purple transition-colors tracking-wide">
                      ENTER PATH MANUALLY
                    </h4>
                    <p className="text-xs text-text-dim mt-1">
                      Type the full path if you already know it.
                    </p>
                  </div>
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-border-subtle">
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className="w-full text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          {mode === 'browse' && (
            <motion.div
              key="browse"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DatasetBrowser
                onSelect={handleBrowserSelect}
                onCancel={handleBack}
              />
            </motion.div>
          )}

          {mode === 'manual' && (
            <motion.div
              key="manual"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              <DialogHeader className="mb-6">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBack}
                    className="p-1 rounded hover:bg-elevated transition-colors"
                  >
                    <svg
                      className="w-4 h-4 text-text-dim"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <DialogTitle className="font-display text-xray-purple tracking-wider">
                    ENTER PATH
                  </DialogTitle>
                </div>
                <DialogDescription className="text-text-secondary mt-2">
                  Enter the full Tiled path to the container you want to monitor.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="path" className="text-xs text-text-secondary font-mono">
                    TILED PATH
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim font-mono text-sm">
                      /
                    </span>
                    <Input
                      id="path"
                      type="text"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="tst/sandbox/synaps/reconstructions"
                      className="pl-6 bg-elevated border-border-subtle focus:border-xray-purple font-mono text-sm"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-text-dim font-mono">EXAMPLES:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'tst/sandbox/synaps/reconstructions',
                      'tst/sandbox/synaps/segmentations',
                    ].map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setPath(example)}
                        className={cn(
                          'text-[10px] px-2 py-1 rounded font-mono',
                          'bg-elevated border border-border-subtle',
                          'hover:border-xray-purple hover:text-xray-purple',
                          'transition-colors'
                        )}
                      >
                        {example.split('/').pop()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    className="flex-1 text-text-secondary hover:text-text-primary"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={!path.trim()}
                    className="flex-1 bg-xray-purple text-white hover:bg-xray-purple/80 font-display tracking-wider"
                  >
                    ADD MONITOR
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
