'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { isAdmin } from '../../utils/feature-flags';
import AdminStateSimulator from './AdminStateSimulator';

/**
 * Guard component that only renders the AdminStateSimulator for admin users
 */
export default function AdminStateSimulatorGuard() {
  const [isClient, setIsClient] = useState(false);
  const { currentAccount, isAuthenticated } = useCurrentAccount();

  // Ensure this only runs on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render anything during SSR
  if (!isClient) {
    return null;
  }

  // Only show for admin users
  if (!isAuthenticated || !currentAccount?.email || !isAdmin(currentAccount.email)) {
    return null;
  }

  return <AdminStateSimulator />;
}
