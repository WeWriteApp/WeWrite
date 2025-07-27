"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { getEnvironmentType } from '../../utils/environmentConfig';

export function LoginForm() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signIn(emailOrUsername, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign In</h1>
        <p className="text-muted-foreground">
          Welcome back to WeWrite
        </p>
      </div>

      {error && (
        <Alert className="bg-red-50 dark:bg-red-950 border-theme-medium" style={{ borderColor: 'hsl(0 84% 60% / 0.3)' }}>
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-600 dark:text-red-400">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="emailOrUsername">Email or Username</Label>
          <Input
            id="emailOrUsername"
            type="text"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            placeholder="Enter your email or username"
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className="text-center space-y-2">
        <Link
          href="/auth/forgot-password"
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Forgot your password?
        </Link>
        
        <div className="text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link
            href="/auth/register"
            className="text-foreground hover:underline font-medium"
          >
            Sign up
          </Link>
        </div>
      </div>

      {/* Only show test account info in development */}
      {getEnvironmentType() === 'development' && (
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>Test accounts for development:</p>
          <p>jamie@wewrite.app • test@wewrite.app</p>
        </div>
      )}
    </div>
  );
}
