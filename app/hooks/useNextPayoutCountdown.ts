'use client';

import { useState, useEffect } from 'react';

interface PayoutCountdown {
  days: number;
  hours: number;
  minutes: number;
  hasExpired: boolean;
  nextPayoutDate: Date;
}

/**
 * Get the next payout date (1st of next month at 9 AM UTC)
 * This matches the logic from PayoutCountdownTimer component
 */
function getNextPayoutDate(): Date {
  const now = new Date();
  const nextPayout = new Date();
  
  // Set to 1st of next month at 9 AM UTC
  nextPayout.setUTCMonth(now.getUTCMonth() + 1);
  nextPayout.setUTCDate(1);
  nextPayout.setUTCHours(9);
  nextPayout.setUTCMinutes(0);
  nextPayout.setUTCSeconds(0);
  nextPayout.setUTCMilliseconds(0);
  
  return nextPayout;
}

/**
 * Calculate time remaining until next payout
 */
function getTimeUntilNextPayout(): PayoutCountdown {
  const now = new Date();
  const nextPayout = getNextPayoutDate();
  const timeDiff = nextPayout.getTime() - now.getTime();
  
  if (timeDiff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      hasExpired: true,
      nextPayoutDate: nextPayout
    };
  }
  
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    days,
    hours,
    minutes,
    hasExpired: false,
    nextPayoutDate: nextPayout
  };
}

/**
 * Hook to get countdown until next payout
 * Updates every minute to keep the countdown current
 */
export function useNextPayoutCountdown(): PayoutCountdown {
  const [countdown, setCountdown] = useState<PayoutCountdown>(() => getTimeUntilNextPayout());

  useEffect(() => {
    const updateCountdown = () => {
      setCountdown(getTimeUntilNextPayout());
    };

    // Update immediately
    updateCountdown();

    // Update every minute
    const interval = setInterval(updateCountdown, 60000);

    return () => clearInterval(interval);
  }, []);

  return countdown;
}

/**
 * Format countdown for display in compact format
 * Returns "in X days", "in X hours", "in X minutes", or "Processing"
 */
export function formatPayoutCountdown(countdown: PayoutCountdown): string {
  if (countdown.hasExpired) {
    return 'Processing';
  }
  
  if (countdown.days > 0) {
    return `in ${countdown.days} day${countdown.days === 1 ? '' : 's'}`;
  }
  
  if (countdown.hours > 0) {
    return `in ${countdown.hours} hour${countdown.hours === 1 ? '' : 's'}`;
  }
  
  if (countdown.minutes > 0) {
    return `in ${countdown.minutes} minute${countdown.minutes === 1 ? '' : 's'}`;
  }
  
  return 'in <1 minute';
}
