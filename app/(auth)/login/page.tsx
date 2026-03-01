'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type AuthMode = 'password' | 'apikey';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithApiKey, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(username, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await loginWithApiKey(apiKey);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-chamber border-border-subtle">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-display text-beam-cyan tracking-wider">
            SYNAPS MONITOR
          </CardTitle>
          <CardDescription className="text-text-secondary">
            Sign in to access the pipeline dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2 p-1 bg-elevated rounded-lg">
            <button
              type="button"
              onClick={() => setMode('password')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm transition-all',
                mode === 'password'
                  ? 'bg-beam-cyan/20 text-beam-cyan'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <User className="w-4 h-4" />
              Password
            </button>
            <button
              type="button"
              onClick={() => setMode('apikey')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm transition-all',
                mode === 'apikey'
                  ? 'bg-xray-purple/20 text-xray-purple'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <Key className="w-4 h-4" />
              API Key
            </button>
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm text-text-secondary">
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="bg-elevated border-border-subtle focus:border-beam-cyan"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm text-text-secondary">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="bg-elevated border-border-subtle focus:border-beam-cyan"
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-status-error bg-status-error/10 p-3 rounded border border-status-error/20">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-beam-cyan text-void hover:bg-beam-cyan-bright font-display tracking-wider"
              >
                {isLoading ? 'AUTHENTICATING...' : 'SIGN IN'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleApiKeySubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="apikey" className="text-sm text-text-secondary">
                  API Key
                </label>
                <Input
                  id="apikey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Tiled API key"
                  className="bg-elevated border-border-subtle focus:border-xray-purple font-mono text-sm"
                  required
                />
                <p className="text-xs text-text-dim">
                  Generate an API key from the Tiled web UI or using{' '}
                  <code className="bg-elevated px-1 rounded">tiled profile api-key create</code>
                </p>
              </div>

              {error && (
                <div className="text-sm text-status-error bg-status-error/10 p-3 rounded border border-status-error/20">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-xray-purple text-white hover:bg-xray-purple/80 font-display tracking-wider"
              >
                {isLoading ? 'AUTHENTICATING...' : 'SIGN IN WITH API KEY'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
