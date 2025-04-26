'use client';

/**
 * reCAPTCHA v3 utility functions
 * 
 * This file provides utility functions for working with Google reCAPTCHA v3.
 * It handles loading the reCAPTCHA script, executing verification, and fallback to v2 if needed.
 */

// reCAPTCHA site key - should be moved to environment variables in production
const RECAPTCHA_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // Test key for development

/**
 * Load the reCAPTCHA script if it's not already loaded
 * 
 * @returns A promise that resolves when the script is loaded
 */
export const loadReCaptchaScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if the script is already loaded
    if (window.grecaptcha && window.grecaptcha.execute) {
      resolve();
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    
    // Set up callbacks
    script.onload = () => resolve();
    script.onerror = (error) => reject(new Error(`reCAPTCHA script failed to load: ${error}`));
    
    // Add script to document
    document.head.appendChild(script);
  });
};

/**
 * Execute reCAPTCHA v3 verification
 * 
 * @param action The action name for analytics (e.g., 'login', 'register')
 * @returns A promise that resolves with the reCAPTCHA token
 */
export const executeReCaptcha = async (action: string): Promise<string> => {
  try {
    // Load the script if not already loaded
    await loadReCaptchaScript();
    
    // Wait for grecaptcha to be fully initialized
    if (!window.grecaptcha || !window.grecaptcha.execute) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Execute reCAPTCHA
    const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
    return token;
  } catch (error) {
    console.error('reCAPTCHA execution failed:', error);
    throw error;
  }
};

/**
 * Verify if the reCAPTCHA score is acceptable
 * 
 * @param token The reCAPTCHA token to verify
 * @returns A promise that resolves with the verification result
 */
export const verifyReCaptchaScore = async (token: string): Promise<{
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  error?: string;
}> => {
  try {
    // In a real implementation, this would call your backend API
    // which would then call the Google reCAPTCHA verification API
    
    // For demo purposes, we'll simulate a successful verification with a random score
    const score = Math.random();
    const success = score >= 0.5;
    
    return {
      success,
      score,
      action: 'demo',
      challenge_ts: new Date().toISOString(),
      hostname: window.location.hostname
    };
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error);
    return {
      success: false,
      error: 'Verification failed'
    };
  }
};

// Add TypeScript interface for the global window object
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (container: string | HTMLElement, parameters: any) => number;
    };
  }
}
