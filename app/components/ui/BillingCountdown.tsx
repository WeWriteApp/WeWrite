'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

interface BillingCountdownProps {
  billingDate: string | Date | null | undefined;
  cancelAtPeriodEnd?: boolean;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export function BillingCountdown({ 
  billingDate, 
  cancelAtPeriodEnd = false, 
  className = '' 
}: BillingCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });
  const [isClient, setIsClient] = useState(false);

  // Calculate time remaining
  const calculateTimeRemaining = (targetDate: Date): TimeRemaining => {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, isExpired: false };
  };

  // Parse and validate the billing date
  const parseBillingDate = (date: string | Date | null | undefined): Date | null => {
    if (!date) return null;

    try {
      let parsedDate: Date;
      
      if (typeof date === 'string') {
        // Handle various date formats
        if (date.includes('T') || date.includes('Z')) {
          // ISO string
          parsedDate = new Date(date);
        } else if (date.includes('-')) {
          // YYYY-MM-DD format
          parsedDate = new Date(date + 'T00:00:00');
        } else {
          // Try parsing as-is
          parsedDate = new Date(date);
        }
      } else {
        parsedDate = new Date(date);
      }

      // Check if the date is valid
      if (isNaN(parsedDate.getTime())) {
        return null;
      }

      return parsedDate;
    } catch (error) {
      console.error('Error parsing billing date:', error);
      return null;
    }
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const targetDate = parseBillingDate(billingDate);
    if (!targetDate) {
      setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
      return;
    }

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining(targetDate));

    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(targetDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [billingDate, isClient]);

  // Don't render on server to avoid hydration mismatch
  if (!isClient) {
    return (
      <p className={`text-sm text-muted-foreground ${className}`}>
        <Calendar className="h-4 w-4 inline mr-1" />
        Loading billing information...
      </p>
    );
  }

  const targetDate = parseBillingDate(billingDate);
  
  // Handle invalid or missing date
  if (!targetDate) {
    return (
      <p className={`text-sm text-muted-foreground ${className}`}>
        <Calendar className="h-4 w-4 inline mr-1" />
        Billing date unavailable
      </p>
    );
  }

  // Handle expired date
  if (timeRemaining.isExpired) {
    return (
      <p className={`text-sm text-muted-foreground ${className}`}>
        <Calendar className="h-4 w-4 inline mr-1" />
        {cancelAtPeriodEnd ? 'Subscription has ended' : 'Billing date has passed'}
      </p>
    );
  }

  // Format the countdown display
  const formatCountdown = () => {
    const parts = [];
    
    if (timeRemaining.days > 0) {
      parts.push(`${timeRemaining.days} day${timeRemaining.days === 1 ? '' : 's'}`);
    }
    
    if (timeRemaining.hours > 0 || timeRemaining.days > 0) {
      parts.push(`${timeRemaining.hours} hour${timeRemaining.hours === 1 ? '' : 's'}`);
    }
    
    if (timeRemaining.days === 0) {
      parts.push(`${timeRemaining.minutes} minute${timeRemaining.minutes === 1 ? '' : 's'}`);
    }

    return parts.join(', ');
  };

  const prefix = cancelAtPeriodEnd ? 'Subscription ends in:' : 'Next billing in:';
  const staticDate = targetDate.toLocaleDateString();

  return (
    <div className={`text-sm text-muted-foreground ${className}`}>
      <div className="flex items-center gap-1 mb-1">
        <Clock className="h-4 w-4" />
        <span className="font-medium">{prefix}</span>
      </div>
      <div className="ml-5">
        <div className="font-mono text-sm">
          {formatCountdown()}
        </div>
        <div className="text-xs opacity-75">
          {staticDate}
        </div>
      </div>
    </div>
  );
}
