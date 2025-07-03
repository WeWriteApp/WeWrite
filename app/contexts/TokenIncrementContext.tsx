'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface TokenIncrementContextType {
  incrementAmount: number;
  customAmount: string;
  setIncrementAmount: (amount: number) => void;
  setCustomAmount: (amount: string) => void;
  handleIncrementChange: (amount: number | 'custom') => void;
}

const TokenIncrementContext = createContext<TokenIncrementContextType | undefined>(undefined);

export function TokenIncrementProvider({ children }: { children: React.ReactNode }) {
  const [incrementAmount, setIncrementAmount] = useState(1);
  const [customAmount, setCustomAmount] = useState('');

  // Load saved increment amount from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tokenIncrementAmount');
    if (saved) {
      const amount = parseInt(saved);
      if (amount > 0) {
        setIncrementAmount(amount);
      }
    }
  }, []);

  // Save increment amount to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('tokenIncrementAmount', incrementAmount.toString());
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
    <TokenIncrementContext.Provider
      value={{
        incrementAmount,
        customAmount,
        setIncrementAmount,
        setCustomAmount,
        handleIncrementChange,
      }}
    >
      {children}
    </TokenIncrementContext.Provider>
  );
}

export function useTokenIncrement() {
  const context = useContext(TokenIncrementContext);
  if (context === undefined) {
    throw new Error('useTokenIncrement must be used within a TokenIncrementProvider');
  }
  return context;
}
