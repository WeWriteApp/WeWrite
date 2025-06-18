"use client";

import { useEffect, useState } from 'react';
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
  const paymentsEnabled = useFeatureFlag('payments', user?.email, user?.uid);
  const [hasCheckedFlag, setHasCheckedFlag] = useState(false);

  useEffect(() => {
    // Wait a moment to ensure feature flags have loaded before making decisions
    const timer = setTimeout(() => {
      setHasCheckedFlag(true);

      // Only redirect if we've confirmed the flag is disabled after loading
      if (paymentsEnabled === false) {
        console.log('[PaymentFeatureGuard] Payments feature disabled, redirecting to:', redirectTo);
        router.push(redirectTo);
      }
    }, 200); // Small delay to allow feature flags to load

    return () => clearTimeout(timer);
  }, [paymentsEnabled, router, redirectTo]);

  // Don't render children if payments are confirmed disabled after checking
  if (hasCheckedFlag && paymentsEnabled === false) {
    return null;
  }

  // Render children if payments are enabled or still loading/checking
  return <>{children}</>;
}
