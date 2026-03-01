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
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-chamber/80 backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-display font-semibold tracking-wider text-beam-cyan">
            SYNAPS PIPELINE MONITOR
          </h1>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-1.5 text-xs text-status-complete">
                <Wifi className="h-3 w-3" />
                <span className="animate-status-pulse inline-block h-2 w-2 rounded-full bg-status-complete" />
                LIVE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-text-dim">
                <WifiOff className="h-3 w-3" />
                OFFLINE
              </span>
            )}
          </div>
        </div>

        {isAuthenticated && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <User className="h-4 w-4" />
              <span>{user?.identities?.[0]?.id || 'User'}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-text-dim hover:text-text-primary hover:bg-elevated"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
