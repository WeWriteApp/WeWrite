"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  SyncQueueState,
  getSyncQueueState,
  getQueueCount,
  triggerManualSync,
  initializeSyncQueue,
  isEmailVerified,
  shouldUseQueue
} from '../utils/syncQueue';
import { useAuth } from '../providers/AuthProvider';
import { checkEmailVerificationOnFeatureAccess } from '../services/emailVerificationNotifications';

interface SyncQueueContextType {
  state: SyncQueueState;
  queueCount: number;
  isEmailVerified: boolean;
  shouldUseQueue: boolean;
  triggerSync: () => Promise<void>;
  refreshState: () => void;
}

const SyncQueueContext = createContext<SyncQueueContextType | undefined>(undefined);

export function useSyncQueue(): SyncQueueContextType {
  const context = useContext(SyncQueueContext);
  if (!context) {
    throw new Error('useSyncQueue must be used within a SyncQueueProvider');
  }
  return context;
}

interface SyncQueueProviderProps {
  children: ReactNode;
}

export function SyncQueueProvider({ children }: SyncQueueProviderProps) {
  const { user } = useAuth();
  const [state, setState] = useState<SyncQueueState>(() => getSyncQueueState());
  const [queueCount, setQueueCount] = useState<number>(0);

  // Refresh state function
  const refreshState = () => {
    const newState = getSyncQueueState();
    const newCount = getQueueCount();
    setState(newState);
    setQueueCount(newCount);
  };

  // Trigger manual sync
  const triggerSync = async () => {
    try {
      // Check for email verification notification before syncing
      if (!isEmailVerified()) {
        await checkEmailVerificationOnFeatureAccess();
      }

      await triggerManualSync();
      refreshState();
    } catch (error) {
      console.error('Error triggering manual sync:', error);
    }
  };

  // Initialize sync queue system
  useEffect(() => {
    initializeSyncQueue();
    refreshState();

    // Listen for sync queue updates
    const handleSyncUpdate = () => {
      refreshState();
    };

    window.addEventListener('syncQueueUpdated', handleSyncUpdate);
    
    // Refresh state periodically
    const interval = setInterval(refreshState, 30000); // Every 30 seconds

    return () => {
      window.removeEventListener('syncQueueUpdated', handleSyncUpdate);
      clearInterval(interval);
    };
  }, []);

  // Refresh state when user changes
  useEffect(() => {
    refreshState();
  }, [user]);

  const contextValue: SyncQueueContextType = {
    state,
    queueCount,
    isEmailVerified: isEmailVerified(),
    shouldUseQueue: shouldUseQueue(),
    triggerSync,
    refreshState
  };

  return (
    <SyncQueueContext.Provider value={contextValue}>
      {children}
    </SyncQueueContext.Provider>
  );
}
