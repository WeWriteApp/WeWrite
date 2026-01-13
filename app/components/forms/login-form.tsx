"use client";

import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { InlineError } from '../ui/InlineError';
import Link from 'next/link';
import { getEnvironmentType } from '../../utils/environmentConfig';
import { looksLikeEmail } from '@/utils/validationPatterns';

// Constants for rate limiting
const MAX_ATTEMPTS_BEFORE_WARNING = 3;
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_STORAGE_KEY = 'wewrite_login_attempts';

interface LoginAttemptData {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
}

export function LoginForm() {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [attemptData, setAttemptData] = useState<LoginAttemptData>({ count: 0, lastAttempt: 0, lockedUntil: null });

  const { signIn, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Load attempt data from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(ATTEMPT_STORAGE_KEY);
    if (stored) {
      try {
        const data: LoginAttemptData = JSON.parse(stored);
        // Reset count if last attempt was more than 30 minutes ago
        if (Date.now() - data.lastAttempt > 30 * 60 * 1000) {
          localStorage.removeItem(ATTEMPT_STORAGE_KEY);
          setAttemptData({ count: 0, lastAttempt: 0, lockedUntil: null });
        } else {
          setAttemptData(data);
          // Check if still locked
          if (data.lockedUntil && Date.now() < data.lockedUntil) {
            setCountdown(Math.ceil((data.lockedUntil - Date.now()) / 1000));
          }
        }
      } catch (e) {
        localStorage.removeItem(ATTEMPT_STORAGE_KEY);
      }
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0) {
        // Lockout expired, reset
        setCountdown(null);
        setError('');
        setAttemptData(prev => ({ ...prev, lockedUntil: null }));
        localStorage.removeItem(ATTEMPT_STORAGE_KEY);
      }
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  // Format countdown as MM:SS
  const formatCountdown = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Record a failed attempt
  const recordFailedAttempt = useCallback((isRateLimited: boolean = false) => {
    const now = Date.now();
    const newData: LoginAttemptData = {
      count: attemptData.count + 1,
      lastAttempt: now,
      lockedUntil: isRateLimited ? now + LOCKOUT_DURATION_MS : attemptData.lockedUntil
    };
    setAttemptData(newData);
    localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(newData));

    // Start countdown if rate limited
    if (isRateLimited) {
      setCountdown(Math.ceil(LOCKOUT_DURATION_MS / 1000));
    }
    // Show warning if approaching limit
    else if (newData.count >= MAX_ATTEMPTS_BEFORE_WARNING && newData.count < MAX_ATTEMPTS_BEFORE_LOCKOUT) {
      const remaining = MAX_ATTEMPTS_BEFORE_LOCKOUT - newData.count;
      setWarning(`Warning: ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout.`);
    }
  }, [attemptData]);

  // Clear attempts on successful login
  const clearAttempts = useCallback(() => {
    localStorage.removeItem(ATTEMPT_STORAGE_KEY);
    setAttemptData({ count: 0, lastAttempt: 0, lockedUntil: null });
    setWarning('');
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/home');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if currently locked out
    if (countdown !== null && countdown > 0) {
      return;
    }

    setIsLoading(true);
    setError('');
    setWarning('');

    try {
      // CRITICAL: Trim inputs to prevent whitespace issues on Android PWA
      const trimmedEmailOrUsername = emailOrUsername.trim();
      const trimmedPassword = password.trim();

      await signIn(trimmedEmailOrUsername, trimmedPassword);
      // Clear attempts on successful login
      clearAttempts();

      // CRITICAL: Clear service worker cache for homepage before redirect
      // This prevents PWA from serving cached logged-out version
      if ('caches' in window) {
        try {
          // Get all cache names and clear homepage from each
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(async (cacheName) => {
              const cache = await caches.open(cacheName);
              // Delete cached homepage entries
              await cache.delete('/');
              await cache.delete(window.location.origin + '/');
            })
          );
        } catch (cacheError) {
          // Failed to clear SW cache - non-fatal
        }
      }

      // Redirect directly to /home after successful login
      // The timestamp ensures service worker doesn't serve stale cache
      window.location.href = '/home?_auth=' + Date.now();
    } catch (err: any) {
      // Check if this is a rate limit error
      const isRateLimited = err.message?.includes('Too many failed login attempts') || 
                           err.code === 'auth/too-many-requests';
      
      if (isRateLimited) {
        recordFailedAttempt(true);
        setError('Too many failed login attempts. Please wait for the timer below, or use "Forgot Password" to reset your password. Note: Closing and reopening the app will NOT reset this timer - it\'s enforced by our security system.');
      } else {
        recordFailedAttempt(false);
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isLockedOut = countdown !== null && countdown > 0;

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign In</h1>
        <p className="text-muted-foreground">
          Welcome back to WeWrite
        </p>
      </div>

      {/* Countdown Timer Alert */}
      {isLockedOut && countdown !== null && (
        <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <Icon name="Clock" size={16} className="text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            <div className="flex flex-col gap-2">
              <span>Account temporarily locked due to too many failed attempts.</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold">{formatCountdown(countdown)}</span>
                <span className="text-sm">until you can try again</span>
              </div>
              <span className="text-xs opacity-80">
                Tip: Use "Forgot Password" below to reset your password immediately.
              </span>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Alert (approaching lockout) */}
      {warning && !isLockedOut && (
        <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <Icon name="AlertCircle" size={16} className="text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            {warning}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <InlineError
          message={error}
          variant="error"
          size="md"
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        name="wewrite-login"
        action="https://www.getwewrite.app/auth/login"
        method="POST"
      >
        <div className="space-y-2">
          <Label htmlFor="emailOrUsername">Email or Username</Label>
          <Input
            id="emailOrUsername"
            name="username"
            type="text"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            onBlur={(e) => setEmailOrUsername(e.target.value.trim())} // Trim on blur for Android PWA
            placeholder="Enter your email or username"
            required
            disabled={isLoading || isLockedOut}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={(e) => setPassword(e.target.value.trim())} // Trim on blur for Android PWA
              placeholder="Enter your password"
              required
              disabled={isLoading || isLockedOut}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading || isLockedOut}
            >
              {showPassword ? (
                <Icon name="EyeOff" size={16} />
              ) : (
                <Icon name="Eye" size={16} />
              )}
            </Button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || isLockedOut}
        >
          {isLoading ? 'Signing in...' : isLockedOut ? `Locked (${formatCountdown(countdown!)})` : 'Sign In'}
        </Button>
      </form>

      <div className="text-center space-y-4">
        <Link
          href={`/auth/forgot-password${looksLikeEmail(emailOrUsername) ? `?email=${encodeURIComponent(emailOrUsername.trim())}` : ''}`}
          className="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
        >
          Forgot your password?
        </Link>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => router.push('/auth/register')}
        >
          Sign up for an account
        </Button>
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
