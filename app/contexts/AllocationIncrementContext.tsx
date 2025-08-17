'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AllocationIncrementContextType {
  incrementAmount: number;
  customAmount: string;
  setIncrementAmount: (amount: number) => void;
  setCustomAmount: (amount: string) => void;
  handleIncrementChange: (amount: number | 'custom') => void;
}

const AllocationIncrementContext = createContext<AllocationIncrementContextType | undefined>(undefined);

export function AllocationIncrementProvider({ children }: { children: React.ReactNode }) {
  const [incrementAmount, setIncrementAmount] = useState(1);
  const [customAmount, setCustomAmount] = useState('');

  // Load saved increment amount from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('allocationIncrementAmount');
    if (saved) {
      const amount = parseInt(saved);
      if (amount > 0) {
        setIncrementAmount(amount);
      }
    }
  }, []);

  // Save increment amount to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('allocationIncrementAmount', incrementAmount.toString());
  }, [incrementAmount]);

  const handleIncrementChange = (amount: number | 'custom') => {
    if (amount === 'custom') {
      const customValue = parseInt(customAmount) || 1;
      setIncrementAmount(customValue);
    } else {
      setIncrementAmount(amount);
      setCustomAmount('');
    }
  };

  return (
    <AllocationIncrementContext.Provider
      value={{
        incrementAmount,
        customAmount,
        setIncrementAmount,
        setCustomAmount,
        handleIncrementChange,
      }}
    >
      {children}
    </AllocationIncrementContext.Provider>
  );
}

export function useAllocationIncrement() {
  const context = useContext(AllocationIncrementContext);
  if (context === undefined) {
    throw new Error('useAllocationIncrement must be used within an AllocationIncrementProvider');
  }
  return context;
}

// Legacy export for backward compatibility during migration
/**
 * @deprecated Use AllocationIncrementProvider instead
 */
export const TokenIncrementProvider = AllocationIncrementProvider;

/**
 * @deprecated Use useAllocationIncrement instead
 */
export const useTokenIncrement = useAllocationIncrement;
