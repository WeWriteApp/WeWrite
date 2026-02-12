/**
 * Turnstile Verification Service
 *
 * Server-side verification of Cloudflare Turnstile tokens.
 * Turnstile is a privacy-focused CAPTCHA alternative that provides
 * invisible challenges when possible, only showing visible widgets
 * when risk is elevated.
 *
 * Environment Variables Required:
 * - TURNSTILE_SECRET_KEY: Server-side secret key from Cloudflare dashboard
 *
 * @see https://developers.cloudflare.com/turnstile/
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  success: boolean;
  challenge_ts?: string;      // Timestamp of the challenge
  hostname?: string;          // Hostname the challenge was solved on
  action?: string;            // Action name if provided during widget render
  cdata?: string;             // Customer data if provided
  error_codes?: string[];     // Error codes if verification failed
}

export interface TurnstileVerifyOptions {
  token: string;
  remoteIp?: string;
  idempotencyKey?: string;
}

/**
 * Verify a Turnstile token on the server side
 */
export async function verifyTurnstileToken(
  options: TurnstileVerifyOptions
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // In development without keys, allow bypass
  if (!secretKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Turnstile] No secret key configured - bypassing verification in development');
      return {
        success: true,
        challenge_ts: new Date().toISOString(),
        hostname: 'localhost',
        action: 'development_bypass',
      };
    }
    console.error('[Turnstile] TURNSTILE_SECRET_KEY not configured');
    return {
      success: false,
      error_codes: ['missing-secret-key'],
    };
  }

  // Handle test tokens
  if (options.token === 'test_token' && process.env.NODE_ENV === 'development') {
    return {
      success: true,
      challenge_ts: new Date().toISOString(),
      hostname: 'localhost',
      action: 'test',
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', options.token);

    if (options.remoteIp) {
      formData.append('remoteip', options.remoteIp);
    }

    if (options.idempotencyKey) {
      formData.append('idempotency_key', options.idempotencyKey);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      console.error('[Turnstile] Verification request failed:', response.status);
      return {
        success: false,
        error_codes: ['network-error'],
      };
    }

    const result: TurnstileVerifyResult = await response.json();

    if (!result.success) {
      console.warn('[Turnstile] Verification failed:', result.error_codes);
    }

    return result;
  } catch (error) {
    console.error('[Turnstile] Verification error:', error);
    return {
      success: false,
      error_codes: ['internal-error'],
    };
  }
}

/**
 * Middleware helper to verify Turnstile token from request
 */
export async function verifyTurnstileFromRequest(
  request: Request,
  tokenField: string = 'turnstileToken'
): Promise<{ verified: boolean; error?: string }> {
  try {
    let token: string | undefined;

    // Try to get token from JSON body
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const body = await request.clone().json();
      token = body[tokenField];
    }

    // Try to get from form data
    if (!token && contentType?.includes('form-data')) {
      const formData = await request.clone().formData();
      token = formData.get(tokenField) as string;
    }

    if (!token) {
      return { verified: false, error: 'No Turnstile token provided' };
    }

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || undefined;

    const result = await verifyTurnstileToken({ token, remoteIp: ip });

    if (!result.success) {
      return {
        verified: false,
        error: result.error_codes?.join(', ') || 'Verification failed',
      };
    }

    return { verified: true };
  } catch (error) {
    console.error('[Turnstile] Request verification error:', error);
    return { verified: false, error: 'Internal verification error' };
  }
}

/**
 * Check if Turnstile is configured and should be enforced
 *
 * Returns false in development mode to allow easier testing.
 * Turnstile is only enforced in production.
 */
export function isTurnstileConfigured(): boolean {
  // Always bypass Turnstile in development mode
  if (process.env.NODE_ENV === 'development') {
    return false;
  }

  return !!(
    process.env.TURNSTILE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  );
}

/**
 * Get the public site key (safe to expose to client)
 */
export function getTurnstileSiteKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}

// Error code descriptions for debugging
export const TURNSTILE_ERROR_CODES: Record<string, string> = {
  'missing-input-secret': 'The secret parameter was not passed.',
  'invalid-input-secret': 'The secret parameter was invalid or did not exist.',
  'missing-input-response': 'The response parameter was not passed.',
  'invalid-input-response': 'The response parameter is invalid or has expired.',
  'bad-request': 'The request was rejected because it was malformed.',
  'timeout-or-duplicate': 'The response parameter has already been validated before.',
  'internal-error': 'An internal error happened while validating the response.',
  'missing-secret-key': 'TURNSTILE_SECRET_KEY environment variable not set.',
  'network-error': 'Failed to connect to Cloudflare verification endpoint.',
};
