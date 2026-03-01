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
import { FolderSearch, Keyboard, ArrowLeft } from 'lucide-react';
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

  const reset = () => {
    setMode('select');
    setPath('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) reset();
      onOpenChange(isOpen);
    }}>
      <DialogContent
        className={cn(
          'bg-surface-base border-border-subtle p-0 gap-0 overflow-hidden rounded-2xl',
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
                <DialogTitle className="text-lg font-semibold text-text-primary">
                  Add Monitor
                </DialogTitle>
                <DialogDescription className="text-text-secondary text-sm">
                  Choose how to select a dataset path to monitor.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3">
                <button
                  onClick={() => setMode('browse')}
                  className="group relative flex items-start gap-4 p-4 rounded-xl bg-surface-raised border border-border-subtle hover:border-beam/50 transition-all text-left beam-caustic"
                >
                  <div className="p-3 rounded-xl bg-beam/10 border border-beam/20 group-hover:border-beam/40 transition-colors">
                    <FolderSearch className="w-5 h-5 text-beam" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-beam transition-colors">
                      Browse Catalog
                    </h4>
                    <p className="text-xs text-text-tertiary mt-1">
                      Navigate through the Tiled data catalog.
                    </p>
                    <span className="inline-block mt-2 badge badge-beam">Recommended</span>
                  </div>
                </button>

                <button
                  onClick={() => setMode('manual')}
                  className="group flex items-start gap-4 p-4 rounded-xl bg-surface-raised border border-border-subtle hover:border-cell/50 transition-all text-left"
                >
                  <div className="p-3 rounded-xl bg-cell/10 border border-cell/20 group-hover:border-cell/40 transition-colors">
                    <Keyboard className="w-5 h-5 text-cell" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-cell transition-colors">
                      Enter Path Manually
                    </h4>
                    <p className="text-xs text-text-tertiary mt-1">
                      Type the full path if you already know it.
                    </p>
                  </div>
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-border-subtle">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
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
              <DatasetBrowser onSelect={handleBrowserSelect} onCancel={reset} />
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
                  <button onClick={reset} className="p-1.5 rounded-md hover:bg-surface-raised transition-colors">
                    <ArrowLeft className="w-4 h-4 text-text-tertiary" />
                  </button>
                  <DialogTitle className="text-lg font-semibold text-text-primary">
                    Enter Path
                  </DialogTitle>
                </div>
                <DialogDescription className="text-text-secondary text-sm mt-2">
                  Enter the full Tiled path to the container you want to monitor.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="data-label">Tiled Path</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary font-mono text-sm">/</span>
                    <Input
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      placeholder="tst/sandbox/synaps/reconstructions"
                      className="pl-6 bg-surface-ground border-border-subtle focus:border-cell font-mono text-sm"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="data-label">Examples</span>
                  <div className="flex flex-wrap gap-2">
                    {['reconstructions', 'segmentations'].map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setPath(`tst/sandbox/synaps/${ex}`)}
                        className="text-[10px] px-2 py-1 rounded-md font-mono bg-surface-raised border border-border-subtle hover:border-cell transition-colors text-text-secondary hover:text-cell"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={reset} className="flex-1">
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={!path.trim()}
                    className="flex-1 bg-cell text-surface-ground hover:bg-cell/90"
                  >
                    Add Monitor
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
