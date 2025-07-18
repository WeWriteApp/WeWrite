'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
// Admin check function - only jamiegray2234@gmail.com has admin access
const isAdmin = (userEmail?: string | null): boolean => {
  if (!userEmail) return false;
  return userEmail === 'jamiegray2234@gmail.com';
};
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
