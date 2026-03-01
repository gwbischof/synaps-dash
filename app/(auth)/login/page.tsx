'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(username, password);
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
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
}
