'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddMonitorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (path: string) => void;
}

const SUGGESTED_PATHS = [
  'tst/sandbox/synaps/reconstructions',
  'tst/sandbox/synaps/segmentations',
];

export function AddMonitorModal({ open, onOpenChange, onAdd }: AddMonitorModalProps) {
  const [path, setPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (path.trim()) {
      onAdd(path.trim());
      setPath('');
      onOpenChange(false);
    }
  };

  const handleSuggestionClick = (suggestedPath: string) => {
    onAdd(suggestedPath);
    setPath('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chamber border-border-subtle sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-beam-cyan tracking-wider">
            ADD DATASET MONITOR
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            Enter the Tiled path to monitor for new datasets.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="path" className="text-sm text-text-secondary">
              Tiled Path
            </label>
            <Input
              id="path"
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="e.g., tst/sandbox/synaps/reconstructions"
              className="bg-elevated border-border-subtle focus:border-beam-cyan font-mono text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-text-dim">Quick add:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PATHS.map((suggestedPath) => (
                <button
                  key={suggestedPath}
                  type="button"
                  onClick={() => handleSuggestionClick(suggestedPath)}
                  className="text-xs px-2 py-1 bg-elevated border border-border-subtle rounded hover:border-beam-cyan hover:text-beam-cyan transition-colors font-mono"
                >
                  {suggestedPath.split('/').pop()}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-text-secondary hover:text-text-primary"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!path.trim()}
              className="bg-beam-cyan text-void hover:bg-beam-cyan-bright font-display tracking-wider"
            >
              ADD COLUMN
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
