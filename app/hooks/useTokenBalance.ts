'use client';

/**
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Use useUsdBalance from UsdBalanceContext instead for USD-based balance management.
 *
 * Legacy token balance hook - replaced by USD system.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { useUsdBalance } from '../contexts/UsdBalanceContext';
import { centsToDollars } from '../utils/formatCurrency';

interface TokenBalance {
  totalTokens: number;
  allocatedTokens: number;
  availableTokens: number;
}

export function useTokenBalance(): TokenBalance | null {
  const { user } = useAuth();
  const { usdBalance } = useUsdBalance();
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setTokenBalance(null);
      return;
    }

    // Convert USD balance to token format for backward compatibility
    if (usdBalance) {
      const totalTokens = Math.floor(centsToDollars(usdBalance.totalUsdCents) * 10);
      const allocatedTokens = Math.floor(centsToDollars(usdBalance.allocatedUsdCents) * 10);
      const availableTokens = totalTokens - allocatedTokens;

      setTokenBalance({
        totalTokens,
        allocatedTokens,
        availableTokens
      });
    } else {
      setTokenBalance(null);
    }
  }, [user?.uid, usdBalance]);

  return tokenBalance;
}
