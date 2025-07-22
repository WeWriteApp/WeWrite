"use client";

/**
 * API-Based Session Initializer
 *
 * This component handles token allocation transfers when users sign in.
 * The AuthProvider handles all session management, so this component
 * just handles token transfers.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { transferLoggedOutAllocationsToUser } from '../../utils/simulatedTokens';

interface ApiSessionInitializerProps {
  children: React.ReactNode;
}

/**
 * Simplified session initializer that handles token transfers
 */
function ApiSessionInitializer({ children }: ApiSessionInitializerProps) {
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
        console.log('ApiSessionInitializer: Transferring tokens for user:', user.uid);
        await transferLoggedOutAllocationsToUser(user.uid);
        hasTransferredTokens.current = true;
        console.log('ApiSessionInitializer: Token transfer completed');
      } catch (error) {
        console.error('ApiSessionInitializer: Error transferring tokens:', error);
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

export default ApiSessionInitializer;
