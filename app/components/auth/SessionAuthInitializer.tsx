"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { transferLoggedOutAllocationsToUser } from '../../utils/simulatedUsd';

interface SessionAuthInitializerProps {
  children: React.ReactNode;
}

/**
 * SessionAuthInitializer - Simplified USD allocation transfer component
 *
 * This component handles USD allocation transfers when users sign in.
 * The AuthProvider handles all session management.
 */
function SessionAuthInitializer({ children }: SessionAuthInitializerProps) {
  const [isClient, setIsClient] = useState(false);
  const { user } = useAuth();
  const hasTransferredAllocations = useRef(false);

  // Set client flag after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Transfer allocations when user signs in
  useEffect(() => {
    if (!isClient || !user || hasTransferredAllocations.current) {
      return;
    }

    const transferAllocations = async () => {
      try {
        console.log('SessionAuthInitializer: Transferring allocations for user:', user.uid);
        transferLoggedOutAllocationsToUser(user.uid);
        hasTransferredAllocations.current = true;
        console.log('SessionAuthInitializer: Allocation transfer completed');
      } catch (error) {
        console.error('SessionAuthInitializer: Error transferring allocations:', error);
      }
    };

    transferAllocations();
  }, [isClient, user]);

  // Reset allocation transfer flag when user changes
  useEffect(() => {
    hasTransferredAllocations.current = false;
  }, [user?.uid]);

  return <>{children}</>;
}
export default SessionAuthInitializer;