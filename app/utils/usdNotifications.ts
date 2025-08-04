/**
 * USD Allocation Notification Utilities
 * 
 * Centralized functions for showing consistent USD allocation notifications
 * across all allocation components.
 */

import { toast } from '../components/ui/use-toast';
import { formatUsdCents } from './formatCurrency';
import { getNextMonthlyProcessingDate } from './subscriptionTiers';

/**
 * Show a success notification for USD allocation changes
 */
export function showUsdAllocationNotification(
  changeCents: number,
  pageTitle: string,
  newAllocationCents: number
) {
  const nextProcessingDate = getNextMonthlyProcessingDate();
  const formattedDate = nextProcessingDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });

  const changeAmount = formatUsdCents(Math.abs(changeCents));
  const totalAmount = formatUsdCents(newAllocationCents);
  
  const isIncrease = changeCents > 0;
  const isDecrease = changeCents < 0;
  const isRemoval = newAllocationCents === 0;

  let title: string;
  let description: string;

  if (isRemoval) {
    title = "Allocation removed";
    description = `Removed all allocation from "${pageTitle}"`;
  } else if (isIncrease) {
    title = `${changeAmount} allocated!`;
    description = `Total allocation: ${totalAmount} • Funds distributed ${formattedDate}`;
  } else if (isDecrease) {
    title = `${changeAmount} removed`;
    description = `Total allocation: ${totalAmount} • Funds distributed ${formattedDate}`;
  } else {
    // No change
    return;
  }

  toast({
    title,
    description,
    duration: 3000,
  });
}

/**
 * Show a success notification for user-to-user USD allocation
 */
export function showUserUsdAllocationNotification(
  changeCents: number,
  username: string,
  newAllocationCents: number
) {
  const nextProcessingDate = getNextMonthlyProcessingDate();
  const formattedDate = nextProcessingDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric'
  });

  const changeAmount = formatUsdCents(Math.abs(changeCents));
  const totalAmount = formatUsdCents(newAllocationCents);
  
  const isIncrease = changeCents > 0;
  const isDecrease = changeCents < 0;
  const isRemoval = newAllocationCents === 0;

  let title: string;
  let description: string;

  if (isRemoval) {
    title = "Allocation removed";
    description = `Removed all allocation from ${username}`;
  } else if (isIncrease) {
    title = `${changeAmount} allocated to ${username}!`;
    description = `Total allocation: ${totalAmount} • Funds distributed ${formattedDate}`;
  } else if (isDecrease) {
    title = `${changeAmount} removed from ${username}`;
    description = `Total allocation: ${totalAmount} • Funds distributed ${formattedDate}`;
  } else {
    // No change
    return;
  }

  toast({
    title,
    description,
    duration: 3000,
  });
}

/**
 * Show an error notification for failed USD allocations
 */
export function showUsdAllocationError(
  error: string,
  context?: {
    pageTitle?: string;
    username?: string;
    changeCents?: number;
  }
) {
  const contextInfo = context?.pageTitle || context?.username || 'allocation';
  
  toast({
    title: "Allocation Failed",
    description: error || `Unable to update ${contextInfo}. Please try again.`,
    variant: "destructive",
    duration: 4000,
  });
}

/**
 * Show a notification for insufficient funds
 */
export function showInsufficientFundsNotification() {
  toast({
    title: "Insufficient funds",
    description: "You don't have enough available funds for this allocation.",
    variant: "destructive",
    duration: 4000,
  });
}

/**
 * Show a notification when trying to allocate to own page
 */
export function showSelfAllocationError() {
  toast({
    title: "Cannot allocate to your own page",
    description: "You cannot allocate funds to pages you created.",
    variant: "destructive",
    duration: 4000,
  });
}

/**
 * Show a notification for rate limiting
 */
export function showRateLimitNotification() {
  toast({
    title: "Too many requests",
    description: "Please wait a moment before making another allocation.",
    variant: "destructive",
    duration: 4000,
  });
}

/**
 * Show a notification for network errors
 */
export function showNetworkErrorNotification() {
  toast({
    title: "Network error",
    description: "Unable to connect to the server. Please check your connection and try again.",
    variant: "destructive",
    duration: 4000,
  });
}

/**
 * Show a notification for authentication required
 */
export function showAuthRequiredNotification() {
  toast({
    title: "Authentication required",
    description: "Please log in to allocate funds.",
    variant: "destructive",
    duration: 4000,
  });
}
