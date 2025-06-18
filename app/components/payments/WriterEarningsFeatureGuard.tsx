"use client";

import React from 'react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useAuth } from '../../providers/AuthProvider';

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
  const { user } = useAuth();
  const paymentsEnabled = useFeatureFlag('payments', user?.email, user?.uid);

  if (!paymentsEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
