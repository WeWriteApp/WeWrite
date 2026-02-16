"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';

// Storage keys
const STORAGE_KEYS = {
  ADMIN_OVERRIDE: 'wewrite_admin_email_banner_override',
  MODAL_DISMISSED: 'wewrite_email_verification_dismissed', // Modal "do this later" was clicked
  // Legacy banner keys that also need to be cleaned up on verification
  EMAIL_BANNER_DISMISSED: 'wewrite_email_banner_dismissed',
  EMAIL_BANNER_DISMISSED_TIMESTAMP: 'wewrite_email_banner_dismissed_timestamp',
  EMAIL_DONT_REMIND: 'wewrite_email_dont_remind',
};

interface EmailVerificationStatus {
  /** Whether the user's email needs verification (real unverified OR admin testing mode) */
  needsVerification: boolean;
  /** Whether the user has dismissed the verification modal (clicked "do this later") */
  isModalDismissed: boolean;
  /** Whether this is admin testing mode (user is actually verified) */
  isAdminTestingMode: boolean;
  /** Whether email is actually verified */
  isActuallyVerified: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Whether the banner should currently be shown (needs verification + modal dismissed) */
  shouldShowBanner: boolean;
}

/**
 * Hook to track email verification status across the app.
 *
 * This considers both:
 * 1. Real unverified users who need to verify their email
 * 2. Admin testing mode where verified admins can simulate unverified state
 *
 * Flow:
 * 1. User sees blocking modal on first login
 * 2. User clicks "do this later" → modal dismissed, banner shows
 * 3. Banner stays visible until user verifies their email
 *
 * The hook responds to localStorage changes and custom events for cross-component synchronization.
 */
export function useEmailVerificationStatus(): EmailVerificationStatus {
  const { user, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<EmailVerificationStatus>({
    needsVerification: false,
    isModalDismissed: false,
    isAdminTestingMode: false,
    isActuallyVerified: true,
    isLoading: true,
    shouldShowBanner: false,
  });

  const checkStatus = useCallback(() => {
    if (typeof window === 'undefined' || !user) {
      setStatus({
        needsVerification: false,
        isModalDismissed: false,
        isAdminTestingMode: false,
        isActuallyVerified: true,
        isLoading: false,
        shouldShowBanner: false,
      });
      return;
    }

    const adminOverride = localStorage.getItem(STORAGE_KEYS.ADMIN_OVERRIDE) === 'true';
    const modalDismissed = localStorage.getItem(STORAGE_KEYS.MODAL_DISMISSED) === 'true';
    const isActuallyVerified = user.emailVerified === true;

    // If user is now verified but localStorage still has any email verification flags,
    // clean them all up so they don't interfere in the future
    if (isActuallyVerified && !adminOverride) {
      const keysToRemove = [
        STORAGE_KEYS.MODAL_DISMISSED,
        STORAGE_KEYS.EMAIL_BANNER_DISMISSED,
        STORAGE_KEYS.EMAIL_BANNER_DISMISSED_TIMESTAMP,
        STORAGE_KEYS.EMAIL_DONT_REMIND,
      ];

      let cleaned = false;
      keysToRemove.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          cleaned = true;
        }
      });

      if (cleaned) {
      }
    }

    // Needs verification if:
    // 1. Real user with unverified email
    // 2. Admin testing mode (regardless of actual verification status)
    const needsVerification = !isActuallyVerified || adminOverride;

    // Banner should show when:
    // 1. User needs verification
    // 2. Modal has been dismissed (user clicked "do this later")
    // Banner stays visible until email is verified (no snooze/dismiss)
    const shouldShowBanner = needsVerification && modalDismissed;

    setStatus({
      needsVerification,
      isModalDismissed: modalDismissed,
      isAdminTestingMode: adminOverride,
      isActuallyVerified,
      isLoading: false,
      shouldShowBanner,
    });
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    checkStatus();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === STORAGE_KEYS.ADMIN_OVERRIDE ||
        e.key === STORAGE_KEYS.MODAL_DISMISSED
      ) {
        checkStatus();
      }
    };

    // Listen for custom events (for same-tab updates)
    const handleBannerOverrideChange = () => {
      checkStatus();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bannerOverrideChange', handleBannerOverrideChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bannerOverrideChange', handleBannerOverrideChange);
    };
  }, [authLoading, checkStatus]);

  return status;
}

/**
 * Helper function to mark the modal as dismissed (user clicked "do this later")
 */
export function dismissModal(): void {
  localStorage.setItem(STORAGE_KEYS.MODAL_DISMISSED, 'true');
  window.dispatchEvent(new CustomEvent('bannerOverrideChange'));
}
