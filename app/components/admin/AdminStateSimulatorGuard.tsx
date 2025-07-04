'use client';

import React from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { isAdmin } from '../../utils/feature-flags';
import AdminStateSimulator from './AdminStateSimulator';

/**
 * Guard component that only renders the AdminStateSimulator for admin users
 */
export default function AdminStateSimulatorGuard() {
  const { currentAccount, isAuthenticated } = useCurrentAccount();

  // Only show for admin users
  if (!isAuthenticated || !currentAccount?.email || !isAdmin(currentAccount.email)) {
    return null;
  }

  return <AdminStateSimulator />;
}
