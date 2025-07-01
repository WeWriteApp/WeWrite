"use client";

import React from 'react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
interface WriterEarningsFeatureGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Feature guard component that only renders writer earnings content
 * when the payments feature flag is enabled
 */
export default function WriterEarningsFeatureGuard({
  children,
  fallback = null
}: WriterEarningsFeatureGuardProps) {
  const { currentAccount } = useCurrentAccount();
  const paymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);

  if (!paymentsEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}