'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { LogOut, User, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  isConnected?: boolean;
}

export function Header({ isConnected = false }: HeaderProps) {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="flex h-14 items-center justify-between px-6">
        {/* Left: Logo & Status */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-beam/20 to-cell/10" />
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-beam relative"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                <path d="M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.5" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-text-primary tracking-tight">
              SYNAPS
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-border-subtle" />

          {/* Connection Status */}
          {isConnected ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-live/10 border border-live/20">
              <Wifi className="w-3 h-3 text-live" />
              <span className="status-dot status-dot-live animate-pulse-live" />
              <span className="text-[11px] font-medium text-live tracking-wide">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-raised border border-border-subtle">
              <WifiOff className="w-3 h-3 text-text-tertiary" />
              <span className="text-[11px] font-medium text-text-tertiary tracking-wide">OFFLINE</span>
            </div>
          )}
        </div>

        {/* Right: User & Logout */}
        {isAuthenticated && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised/50 border border-border-subtle">
              <User className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-[12px] font-mono text-text-secondary">
                {user?.identities?.[0]?.id || 'User'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-8 px-3 text-text-tertiary hover:text-text-primary hover:bg-surface-raised rounded-lg text-[12px] gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
