/**
 * Turnstile Client Utilities
 *
 * Client-side utilities for Cloudflare Turnstile integration.
 * Provides functions to render, reset, and manage Turnstile widgets.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */

// Turnstile script URL
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Global Turnstile object type
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: TurnstileRenderOptions
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string | undefined;
      isExpired: (widgetId: string) => boolean;
    };
    onTurnstileLoad?: () => void;
  }
}

export type TurnstileTheme = 'light' | 'dark' | 'auto';
export type TurnstileSize = 'normal' | 'compact' | 'invisible';
export type TurnstileAppearance = 'always' | 'execute' | 'interaction-only';

export interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: (error: string) => void;
  'before-interactive-callback'?: () => void;
  'after-interactive-callback'?: () => void;
  theme?: TurnstileTheme;
  size?: TurnstileSize;
  tabindex?: number;
  action?: string;
  cData?: string;
  'response-field'?: boolean;
  'response-field-name'?: string;
  retry?: 'auto' | 'never';
  'retry-interval'?: number;
  'refresh-expired'?: 'auto' | 'manual' | 'never';
  appearance?: TurnstileAppearance;
  execution?: 'render' | 'execute';
  language?: string;
}

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

/**
 * Load the Turnstile script dynamically
 */
export function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (scriptLoaded && window.turnstile) {
      resolve();
      return;
    }

    // Add to callback queue
    loadCallbacks.push(resolve);

    // Already loading
    if (scriptLoading) {
      return;
    }

    scriptLoading = true;

    // Check if script already exists
    const existingScript = document.querySelector(
      `script[src^="${TURNSTILE_SCRIPT_URL}"]`
    );
    if (existingScript) {
      // Wait for it to load
      existingScript.addEventListener('load', () => {
        scriptLoaded = true;
        loadCallbacks.forEach((cb) => cb());
        loadCallbacks.length = 0;
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Turnstile script'));
      });
      return;
    }

    // Create and append script
    const script = document.createElement('script');
    script.src = `${TURNSTILE_SCRIPT_URL}?render=explicit&onload=onTurnstileLoad`;
    script.async = true;
    script.defer = true;

    window.onTurnstileLoad = () => {
      scriptLoaded = true;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };

    script.onerror = () => {
      scriptLoading = false;
      reject(new Error('Failed to load Turnstile script'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Render a Turnstile widget
 */
export async function renderTurnstile(
  container: string | HTMLElement,
  options: Omit<TurnstileRenderOptions, 'sitekey'> & { sitekey?: string }
): Promise<string> {
  await loadTurnstileScript();

  if (!window.turnstile) {
    throw new Error('Turnstile not loaded');
  }

  const sitekey = options.sitekey || getTurnstileSiteKey();
  if (!sitekey) {
    throw new Error('Turnstile site key not configured');
  }

  return window.turnstile.render(container, {
    ...options,
    sitekey,
  });
}

/**
 * Reset a Turnstile widget
 */
export function resetTurnstile(widgetId: string): void {
  if (window.turnstile) {
    window.turnstile.reset(widgetId);
  }
}

/**
 * Remove a Turnstile widget
 */
export function removeTurnstile(widgetId: string): void {
  if (window.turnstile) {
    window.turnstile.remove(widgetId);
  }
}

/**
 * Get the response token from a widget
 */
export function getTurnstileResponse(widgetId: string): string | undefined {
  return window.turnstile?.getResponse(widgetId);
}

/**
 * Check if a widget token has expired
 */
export function isTurnstileExpired(widgetId: string): boolean {
  return window.turnstile?.isExpired(widgetId) ?? true;
}

/**
 * Get the site key from environment
 */
export function getTurnstileSiteKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}

/**
 * Check if Turnstile is configured
 */
export function isTurnstileConfigured(): boolean {
  return !!getTurnstileSiteKey();
}

/**
 * Get appropriate Turnstile size based on risk level
 */
export function getTurnstileSizeForRisk(
  riskLevel: 'allow' | 'soft_challenge' | 'hard_challenge' | 'block'
): TurnstileSize {
  switch (riskLevel) {
    case 'allow':
      return 'invisible';
    case 'soft_challenge':
      return 'invisible';
    case 'hard_challenge':
      return 'normal';
    case 'block':
      return 'normal'; // Block will be handled separately
    default:
      return 'invisible';
  }
}

/**
 * Development mode test token
 */
export const DEV_TEST_TOKEN = 'test_token';

/**
 * Check if we're in development mode and should bypass Turnstile
 */
export function shouldBypassTurnstile(): boolean {
  return (
    process.env.NODE_ENV === 'development' && !isTurnstileConfigured()
  );
}
