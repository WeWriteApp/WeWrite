'use client';

import React, { useState, useEffect } from 'react';
import { getTimeUntilAllocationDeadline } from '../utils/subscriptionTiers';

interface CountdownTimerProps {
  className?: string;
  showExplanation?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
  hasExpired: boolean;
}

export default function AllocationCountdownTimer({ 
  className = '', 
  showExplanation = true 
}: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    totalMs: 0,
    hasExpired: false
  });

  useEffect(() => {
    const updateTimer = () => {
      const remaining = getTimeUntilAllocationDeadline();
      setTimeRemaining(remaining);
    };

    // Update immediately
    updateTimer();

    // Update every minute
    const interval = setInterval(updateTimer, 60000);

    return () => clearInterval(interval);
  }, []);

  if (timeRemaining.hasExpired) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-yellow-800">Allocation Period Ended</h3>
        </div>
        <p className="text-yellow-700 text-sm mt-2">
          Token allocations for this month have been finalized and sent to writers. 
          New allocations will be available after monthly processing completes.
        </p>
        {showExplanation && (
          <div className="mt-3 text-xs text-yellow-600">
            <p><strong>What happens next:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Your allocated tokens are sent to writers</li>
              <li>Writers can request payouts</li>
              <li>Your subscription renews with new tokens</li>
              <li>You can start allocating again!</li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  const formatTime = (value: number, unit: string) => {
    return `${value} ${unit}${value !== 1 ? 's' : ''}`;
  };

  const getUrgencyColor = () => {
    if (timeRemaining.days === 0 && timeRemaining.hours < 6) {
      return 'red'; // Very urgent
    } else if (timeRemaining.days === 0) {
      return 'orange'; // Urgent
    } else if (timeRemaining.days <= 2) {
      return 'yellow'; // Warning
    } else {
      return 'blue'; // Normal
    }
  };

  const urgencyColor = getUrgencyColor();
  const colorClasses = {
    red: 'bg-red-50 border-red-200 text-red-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const dotClasses = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500'
  };

  return (
    <div className={`${colorClasses[urgencyColor]} border rounded-lg p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 ${dotClasses[urgencyColor]} rounded-full ${urgencyColor === 'red' ? 'animate-pulse' : ''}`}></div>
          <h3 className="font-semibold">Allocation Deadline</h3>
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
            {(timeRemaining.days === 0 || timeRemaining.hours === 0) && (
              <span>{formatTime(timeRemaining.minutes, 'minute')}</span>
            )}
          </div>
          <div className="text-xs opacity-75">
            until allocations are finalized
          </div>
        </div>
      </div>

      <p className="text-sm mt-3 text-muted-foreground">
        Allocate all your tokens before they're sent to writers.
      </p>
    </div>
  );
}

// Compact version for smaller spaces
export function CompactAllocationTimer({ className = '' }: { className?: string }) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    totalMs: 0,
    hasExpired: false
  });

  useEffect(() => {
    const updateTimer = () => {
      const remaining = getTimeUntilAllocationDeadline();
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, []);

  if (timeRemaining.hasExpired) {
    return (
      <div className={`inline-flex items-center space-x-2 text-yellow-600 ${className}`}>
        <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></div>
        <span className="text-sm font-medium">Allocations finalized</span>
      </div>
    );
  }

  const getCompactTime = () => {
    if (timeRemaining.days > 0) {
      return `${timeRemaining.days}d ${timeRemaining.hours}h`;
    } else if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}h ${timeRemaining.minutes}m`;
    } else {
      return `${timeRemaining.minutes}m`;
    }
  };

  const urgencyColor = timeRemaining.days === 0 && timeRemaining.hours < 6 ? 'red' : 
                      timeRemaining.days === 0 ? 'orange' : 
                      timeRemaining.days <= 2 ? 'yellow' : 'blue';

  const textClasses = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    yellow: 'text-yellow-600',
    blue: 'text-blue-600'
  };

  const dotClasses = {
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500'
  };

  return (
    <div className={`inline-flex items-center space-x-2 ${textClasses[urgencyColor]} ${className}`}>
      <div className={`w-1.5 h-1.5 ${dotClasses[urgencyColor]} rounded-full ${urgencyColor === 'red' ? 'animate-pulse' : ''}`}></div>
      <span className="text-sm font-medium font-mono">{getCompactTime()}</span>
      <span className="text-xs opacity-75">left</span>
    </div>
  );
}
