"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { getAnalyticsService } from '../utils/analytics-service';
import { INTERACTION_EVENTS, EVENT_CATEGORIES } from '../constants/analytics-events';
import { formatUsdCents } from '../utils/formatCurrency';
import { toast } from '../components/ui/use-toast';

interface AllocationIntervalContextType {
  allocationIntervalCents: number;
  setAllocationInterval: (cents: number) => void;
  isLoading: boolean;
}

const AllocationIntervalContext = createContext<AllocationIntervalContextType | undefined>(undefined);

export function useAllocationInterval() {
  const context = useContext(AllocationIntervalContext);
  if (context === undefined) {
    throw new Error('useAllocationInterval must be used within an AllocationIntervalProvider');
  }
  return context;
}

interface AllocationIntervalProviderProps {
  children: React.ReactNode;
}

// Predefined interval options in cents
export const ALLOCATION_INTERVAL_OPTIONS = [
  { label: '$0.01', cents: 1 },
  { label: '$0.10', cents: 10 },
  { label: '$0.50', cents: 50 },
  { label: '$1.00', cents: 100 },
  { label: '$5.00', cents: 500 },
  { label: '$10.00', cents: 1000 },
] as const;

export const DEFAULT_ALLOCATION_INTERVAL_CENTS = 50; // $0.50

export function AllocationIntervalProvider({ children }: AllocationIntervalProviderProps) {
  const { user } = useAuth();
  const [allocationIntervalCents, setAllocationIntervalCents] = useState(DEFAULT_ALLOCATION_INTERVAL_CENTS);
  const [isLoading, setIsLoading] = useState(true);

  // Load user's allocation interval preference
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadAllocationInterval = async () => {
      try {
        const response = await fetch('/api/user-preferences/allocation-interval');
        if (response.ok) {
          const data = await response.json();
          if (data.allocationIntervalCents) {
            setAllocationIntervalCents(data.allocationIntervalCents);
          }
        }
      } catch (error) {
        console.error('Error loading allocation interval:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllocationInterval();
  }, [user]);

  // Save allocation interval preference with analytics tracking
  const setAllocationInterval = useCallback(async (cents: number) => {
    if (!user) return;

    // Validate the interval
    if (cents < 1 || cents > 10000) { // Max $100.00
      console.error('Invalid allocation interval:', cents);
      return;
    }

    // Track the allocation increment change
    const analytics = getAnalyticsService();
    analytics.trackEvent({
      category: EVENT_CATEGORIES.ALLOCATION,
      action: INTERACTION_EVENTS.ALLOCATION_INCREMENT_CHANGED,
      label: `${formatUsdCents(allocationIntervalCents)} → ${formatUsdCents(cents)}`,
      from_cents: allocationIntervalCents,
      to_cents: cents,
      from_formatted: formatUsdCents(allocationIntervalCents),
      to_formatted: formatUsdCents(cents)
    });

    // Optimistic update
    const previousCents = allocationIntervalCents;
    setAllocationIntervalCents(cents);

    try {
      const response = await fetch('/api/user-preferences/allocation-interval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allocationIntervalCents: cents
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${response.status})`);
      }
    } catch (error) {
      // Rollback on error
      setAllocationIntervalCents(previousCents);
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error saving allocation interval:', error);
      toast.error("Failed to save allocation interval", {
        description: msg,
        enableCopy: true,
        copyText: `Allocation interval error: ${msg}\nTime: ${new Date().toISOString()}`
      });
    }
  }, [user, allocationIntervalCents]);

  return (
    <AllocationIntervalContext.Provider
      value={{
        allocationIntervalCents,
        setAllocationInterval,
        isLoading
      }}
    >
      {children}
    </AllocationIntervalContext.Provider>
  );
}
