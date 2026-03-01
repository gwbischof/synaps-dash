'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { MonitorConfig } from '@/lib/tiled/types';

const STORAGE_KEY = 'synaps_monitors';

interface MonitorsContextValue {
  monitors: MonitorConfig[];
  addMonitor: (path: string, label?: string) => void;
  removeMonitor: (id: string) => void;
}

const MonitorsContext = createContext<MonitorsContextValue | null>(null);

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function getLabelFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

export function MonitorsProvider({ children }: { children: React.ReactNode }) {
  const [monitors, setMonitors] = useState<MonitorConfig[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setMonitors(JSON.parse(stored));
        } catch {
          // Invalid data, start fresh
        }
      }
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(monitors));
    }
  }, [monitors, isLoaded]);

  const addMonitor = useCallback((path: string, label?: string) => {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

    // Check for duplicates
    if (monitors.some((m) => m.path === normalizedPath)) {
      return;
    }

    const newMonitor: MonitorConfig = {
      id: generateId(),
      path: normalizedPath,
      label: label || getLabelFromPath(normalizedPath),
    };

    setMonitors((prev) => [...prev, newMonitor]);
  }, [monitors]);

  const removeMonitor = useCallback((id: string) => {
    setMonitors((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <MonitorsContext.Provider value={{ monitors, addMonitor, removeMonitor }}>
      {children}
    </MonitorsContext.Provider>
  );
}

export function useMonitors() {
  const context = useContext(MonitorsContext);
  if (!context) {
    throw new Error('useMonitors must be used within a MonitorsProvider');
  }
  return context;
}
