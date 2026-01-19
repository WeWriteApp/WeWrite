/**
 * Challenge Wrapper Component
 *
 * Wraps forms to provide risk-based Turnstile challenges.
 * Automatically determines challenge type based on risk level.
 *
 * Usage:
 * <ChallengeWrapper onVerified={(token) => handleSubmit(token)}>
 *   <form>...</form>
 * </ChallengeWrapper>
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  loadTurnstileScript,
  renderTurnstile,
  resetTurnstile,
  removeTurnstile,
  getTurnstileSiteKey,
  isTurnstileConfigured,
  shouldBypassTurnstile,
  DEV_TEST_TOKEN,
  type TurnstileSize,
  type TurnstileTheme,
} from '../../utils/turnstile';
import { Icon } from '../ui/Icon';

export type RiskLevel = 'allow' | 'soft_challenge' | 'hard_challenge' | 'block';

export interface ChallengeWrapperProps {
  children: React.ReactNode;
  /** Callback when verification succeeds */
  onVerified?: (token: string) => void;
  /** Callback when verification fails */
  onError?: (error: string) => void;
  /** Callback when token expires */
  onExpired?: () => void;
  /** Override risk level (otherwise determined automatically) */
  riskLevel?: RiskLevel;
  /** Action name for Turnstile analytics */
  action?: string;
  /** Theme for visible widget */
  theme?: TurnstileTheme;
  /** Whether to show the challenge inline or as modal */
  mode?: 'inline' | 'modal';
  /** Custom class for the wrapper */
  className?: string;
  /** Show loading state while Turnstile loads */
  showLoading?: boolean;
  /** Disable the challenge (for testing) */
  disabled?: boolean;
}

interface ChallengeState {
  status: 'idle' | 'loading' | 'ready' | 'verifying' | 'verified' | 'error' | 'blocked';
  token: string | null;
  error: string | null;
}

export function ChallengeWrapper({
  children,
  onVerified,
  onError,
  onExpired,
  riskLevel = 'soft_challenge',
  action,
  theme = 'auto',
  mode = 'inline',
  className = '',
  showLoading = true,
  disabled = false,
}: ChallengeWrapperProps) {
  const [state, setState] = useState<ChallengeState>({
    status: 'idle',
    token: null,
    error: null,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Determine widget size based on risk level
  const getWidgetSize = useCallback((): TurnstileSize => {
    switch (riskLevel) {
      case 'allow':
        return 'invisible';
      case 'soft_challenge':
        return 'invisible';
      case 'hard_challenge':
        return 'normal';
      case 'block':
        return 'normal';
      default:
        return 'invisible';
    }
  }, [riskLevel]);

  // Handle successful verification
  const handleSuccess = useCallback(
    (token: string) => {
      if (!mountedRef.current) return;
      setState({ status: 'verified', token, error: null });
      onVerified?.(token);
    },
    [onVerified]
  );

  // Handle verification error
  const handleError = useCallback(
    (error: string) => {
      if (!mountedRef.current) return;
      setState({ status: 'error', token: null, error });
      onError?.(error);
    },
    [onError]
  );

  // Handle token expiration
  const handleExpired = useCallback(() => {
    if (!mountedRef.current) return;
    setState({ status: 'ready', token: null, error: null });
    onExpired?.();
  }, [onExpired]);

  // Initialize Turnstile
  useEffect(() => {
    mountedRef.current = true;

    // If blocked, don't render widget
    if (riskLevel === 'block') {
      setState({ status: 'blocked', token: null, error: 'Action blocked due to high risk' });
      return;
    }

    // If disabled or should bypass (dev mode without keys)
    if (disabled || shouldBypassTurnstile()) {
      setState({ status: 'verified', token: DEV_TEST_TOKEN, error: null });
      onVerified?.(DEV_TEST_TOKEN);
      return;
    }

    // If Turnstile not configured, allow through
    if (!isTurnstileConfigured()) {
      setState({ status: 'verified', token: '', error: null });
      return;
    }

    // If allow level, skip challenge
    if (riskLevel === 'allow') {
      setState({ status: 'verified', token: '', error: null });
      return;
    }

    const initTurnstile = async () => {
      try {
        setState({ status: 'loading', token: null, error: null });

        await loadTurnstileScript();

        if (!mountedRef.current || !containerRef.current) return;

        const siteKey = getTurnstileSiteKey();
        if (!siteKey) {
          throw new Error('Turnstile site key not configured');
        }

        // Clear any existing widget
        if (widgetIdRef.current) {
          try {
            removeTurnstile(widgetIdRef.current);
          } catch (e) {
            // Ignore removal errors
          }
        }

        // Render new widget
        const widgetId = await renderTurnstile(containerRef.current, {
          sitekey: siteKey,
          callback: handleSuccess,
          'expired-callback': handleExpired,
          'error-callback': handleError,
          theme,
          size: getWidgetSize(),
          action,
          retry: 'auto',
          'refresh-expired': 'auto',
        });

        if (!mountedRef.current) {
          removeTurnstile(widgetId);
          return;
        }

        widgetIdRef.current = widgetId;
        setState({ status: 'ready', token: null, error: null });
      } catch (error) {
        if (!mountedRef.current) return;
        const errorMessage = error instanceof Error ? error.message : 'Failed to load challenge';
        handleError(errorMessage);
      }
    };

    initTurnstile();

    return () => {
      mountedRef.current = false;
      if (widgetIdRef.current) {
        try {
          removeTurnstile(widgetIdRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
        widgetIdRef.current = null;
      }
    };
  }, [riskLevel, disabled, action, theme, getWidgetSize, handleSuccess, handleError, handleExpired, onVerified]);

  // Reset the challenge
  const reset = useCallback(() => {
    if (widgetIdRef.current) {
      resetTurnstile(widgetIdRef.current);
      setState({ status: 'ready', token: null, error: null });
    }
  }, []);

  // Render blocked state
  if (state.status === 'blocked') {
    return (
      <div className={`${className}`}>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-center">
          <Icon name="ShieldX" className="mx-auto mb-2 text-destructive" size={32} />
          <p className="text-sm font-medium text-destructive">
            This action has been blocked due to security concerns.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            If you believe this is an error, please{' '}
            <a href="/settings/about" className="text-primary underline hover:text-primary/80">
              contact support
            </a>.
          </p>
        </div>
      </div>
    );
  }

  // Determine if we need to show visible widget
  const showVisibleWidget = riskLevel === 'hard_challenge' && state.status !== 'verified';

  return (
    <div className={`${className}`}>
      {children}

      {/* Turnstile container - always rendered for invisible challenges */}
      <div
        ref={containerRef}
        className={`turnstile-container ${
          showVisibleWidget ? 'mt-4 flex justify-center' : ''
        }`}
        style={showVisibleWidget ? {} : { position: 'absolute', left: '-9999px' }}
      />

      {/* Loading state for visible widget */}
      {showLoading && state.status === 'loading' && showVisibleWidget && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Icon name="Loader" className="animate-spin" size={16} />
          Loading security check...
        </div>
      )}

      {/* Error state */}
      {state.status === 'error' && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <Icon name="AlertCircle" className="text-destructive mt-0.5" size={16} />
            <div className="flex-1">
              <p className="text-sm text-destructive">{state.error}</p>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-destructive underline mt-1"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verified state indicator (optional - mainly for debugging) */}
      {process.env.NODE_ENV === 'development' && state.status === 'verified' && (
        <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          <Icon name="ShieldCheck" size={12} />
          Challenge passed
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get challenge token from ChallengeWrapper
 */
export function useChallengeToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerified = useCallback((newToken: string) => {
    setToken(newToken);
    setIsVerified(true);
    setError(null);
  }, []);

  const handleError = useCallback((err: string) => {
    setToken(null);
    setIsVerified(false);
    setError(err);
  }, []);

  const handleExpired = useCallback(() => {
    setToken(null);
    setIsVerified(false);
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setIsVerified(false);
    setError(null);
  }, []);

  return {
    token,
    isVerified,
    error,
    handleVerified,
    handleError,
    handleExpired,
    reset,
  };
}

export default ChallengeWrapper;
