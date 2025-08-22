'use client';

import { useState, useEffect } from 'react';
// Removed unused icons for cleaner design

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
  hasExpired: boolean;
}

interface PayoutCountdownTimerProps {
  className?: string;
  showExplanation?: boolean;
  compact?: boolean;
}

/**
 * Get the next payout date (1st of next month at 9 AM UTC)
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
function getTimeUntilNextPayout(): TimeRemaining {
  const now = new Date();
  const nextPayout = getNextPayoutDate();
  const totalMs = nextPayout.getTime() - now.getTime();
  
  if (totalMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      totalMs: 0,
      hasExpired: true
    };
  }
  
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    days,
    hours,
    minutes,
    totalMs,
    hasExpired: false
  };
}

/**
 * Format time unit with proper pluralization
 */
function formatTime(value: number, unit: string): string {
  if (value === 0) return '';
  return `${value} ${unit}${value !== 1 ? 's' : ''}`;
}

/**
 * Get urgency color based on time remaining
 */
function getUrgencyColor(timeRemaining: TimeRemaining): 'red' | 'orange' | 'yellow' | 'blue' {
  if (timeRemaining.hasExpired) return 'red';
  if (timeRemaining.days <= 1) return 'red';
  if (timeRemaining.days <= 3) return 'orange';
  if (timeRemaining.days <= 7) return 'yellow';
  return 'blue';
}

export default function PayoutCountdownTimer({ 
  className = '', 
  showExplanation = true,
  compact = false
}: PayoutCountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    totalMs: 0,
    hasExpired: false
  });

  useEffect(() => {
    const updateTimer = () => {
      const remaining = getTimeUntilNextPayout();
      setTimeRemaining(remaining);
    };

    // Update immediately
    updateTimer();

    // Update every minute
    const interval = setInterval(updateTimer, 60000);

    return () => clearInterval(interval);
  }, []);

  const urgencyColor = getUrgencyColor(timeRemaining);
  const nextPayoutDate = getNextPayoutDate();

  if (compact) {
    return <CompactPayoutTimer timeRemaining={timeRemaining} urgencyColor={urgencyColor} className={className} />;
  }

  const colorClasses = {
    red: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30 text-red-900 dark:text-red-100',
    orange: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/30 text-orange-900 dark:text-orange-100',
    yellow: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/30 text-yellow-900 dark:text-yellow-100',
    blue: 'bg-muted/50 border-border text-muted-foreground'
  };

  if (timeRemaining.hasExpired) {
    return (
      <div className={`${colorClasses.red} border rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <h3 className="font-semibold">Payout Processing</h3>
        </div>
        <p className="text-sm mt-2 opacity-80">
          Payouts are currently being processed. Check back soon for updates.
        </p>
      </div>
    );
  }

  return (
    <div className={`${colorClasses[urgencyColor]} border rounded-lg p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <h3 className="font-semibold">Next Payout</h3>
        </div>
        <div className="text-left sm:text-right">
          <div className="font-mono text-lg sm:text-xl font-bold">
            {timeRemaining.days > 0 && (
              <span>{formatTime(timeRemaining.days, 'day')}</span>
            )}
            {timeRemaining.days > 0 && (timeRemaining.hours > 0 || timeRemaining.minutes > 0) && (
              <span>, </span>
            )}
            {timeRemaining.hours > 0 && (
              <span>{formatTime(timeRemaining.hours, 'hour')}</span>
            )}
            {timeRemaining.hours > 0 && timeRemaining.minutes > 0 && (
              <span>, </span>
            )}
            {timeRemaining.minutes > 0 && (
              <span>{formatTime(timeRemaining.minutes, 'minute')}</span>
            )}
            {timeRemaining.days === 0 && timeRemaining.hours === 0 && timeRemaining.minutes === 0 && (
              <span>Less than a minute</span>
            )}
          </div>
          <div className="text-xs opacity-70 text-left sm:text-right mt-1">
            {nextPayoutDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })} at 9:00 AM UTC
          </div>
        </div>
      </div>

      {showExplanation && (
        <div className="mt-3 pt-3 border-t border-neutral-15">
          <p className="text-sm opacity-70">
            Payouts are processed monthly on the 1st at 9:00 AM UTC.
            Earnings must meet the $25 minimum threshold and require a verified bank account.
          </p>
        </div>
      )}
    </div>
  );
}

// Compact version for smaller spaces
function CompactPayoutTimer({ 
  timeRemaining, 
  urgencyColor, 
  className = '' 
}: { 
  timeRemaining: TimeRemaining; 
  urgencyColor: 'red' | 'orange' | 'yellow' | 'blue';
  className?: string;
}) {
  const getCompactTime = (): string => {
    if (timeRemaining.hasExpired) return 'Processing';
    if (timeRemaining.days > 0) return `${timeRemaining.days}d`;
    if (timeRemaining.hours > 0) return `${timeRemaining.hours}h`;
    if (timeRemaining.minutes > 0) return `${timeRemaining.minutes}m`;
    return '<1m';
  };

  const textClasses = {
    red: 'text-red-600 dark:text-red-400',
    orange: 'text-orange-600 dark:text-orange-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    blue: 'text-muted-foreground'
  };

  return (
    <div className={`inline-flex items-center space-x-2 ${textClasses[urgencyColor]} ${className}`}>
      <span className="text-sm font-medium font-mono">{getCompactTime()}</span>
      <span className="text-xs opacity-75">to payout</span>
    </div>
  );
}
