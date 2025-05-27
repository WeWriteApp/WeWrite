"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { useFeatureFlag } from '../utils/feature-flags';

interface PaymentFeatureGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Component that protects payment-related pages by checking if the payments feature flag is enabled.
 * If disabled, redirects the user to the specified route or home page.
 */
export function PaymentFeatureGuard({ children, redirectTo = '/' }: PaymentFeatureGuardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const paymentsEnabled = useFeatureFlag('payments', user?.email);

  useEffect(() => {
    // If payments feature is disabled, redirect away from payment pages
    if (paymentsEnabled === false) {
      console.log('[PaymentFeatureGuard] Payments feature disabled, redirecting to:', redirectTo);
      router.push(redirectTo);
    }
  }, [paymentsEnabled, router, redirectTo]);

  // Don't render children if payments are disabled
  if (paymentsEnabled === false) {
    return null;
  }

  // Render children if payments are enabled or still loading
  return <>{children}</>;
}
