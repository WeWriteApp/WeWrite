"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { transferLoggedOutAllocationsToUser } from '../../utils/simulatedTokens';

interface SessionAuthInitializerProps {
  children: React.ReactNode;
}

/**
 * SessionAuthInitializer - Token transfer component
 *
 * This component handles token transfers when users sign in.
 * The AuthProvider handles all session management.
 */
function SessionAuthInitializer({ children }: SessionAuthInitializerProps) {
  const [isClient, setIsClient] = useState(false);
  const { user } = useAuth();
  const hasTransferredTokens = useRef(false);

  // Set client flag after hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Transfer tokens when user signs in
  useEffect(() => {
    if (!isClient || !user || hasTransferredTokens.current) {
      return;
    }

    const transferTokens = async () => {
      try {
        console.log('SessionAuthInitializer: Transferring tokens for user:', user.uid);
        await transferLoggedOutAllocationsToUser(user.uid);
        hasTransferredTokens.current = true;
        console.log('SessionAuthInitializer: Token transfer completed');
      } catch (error) {
        console.error('SessionAuthInitializer: Error transferring tokens:', error);
      }
    };

    transferTokens();
  }, [isClient, user]);

  // Reset token transfer flag when user changes
  useEffect(() => {
    hasTransferredTokens.current = false;
  }, [user?.uid]);

  return <>{children}</>;
}
export default SessionAuthInitializer;