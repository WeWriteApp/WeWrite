'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import '../ui/tooltip.css';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../providers/AuthProvider';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

interface SubscriptionEvent {
  id: string;
  type: string;
  description: string;
  timestamp: Date;
  source: string;
  details: {
    amount?: number;
    currency?: string;
    oldAmount?: number;
    newAmount?: number;
    status?: string;
    metadata?: Record<string, any>;
  };
}

interface SubscriptionHistoryProps {
  className?: string;
}

export default function SubscriptionHistory({ className }: SubscriptionHistoryProps) {
  const { user } = useAuth();
  const [history, setHistory] = useState<SubscriptionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      fetchHistory();
    }
  }, [user?.uid]);

  // Refresh history when the component becomes visible (e.g., returning from checkout)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.uid) {
        console.log('[SUBSCRIPTION HISTORY] Page became visible, refreshing history');
        fetchHistory();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.uid]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/subscription-history');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription history');
      }

      const data = await response.json();
      if (data.success) {
        // Convert timestamp strings back to Date objects
        const historyWithDates = data.history.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp)
        }));
        setHistory(historyWithDates);
      } else {
        throw new Error(data.error || 'Failed to fetch history');
      }
    } catch (err) {
      console.error('Error fetching subscription history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription history');
    } finally {
      setLoading(false);
    }
  };



  const getEventBadgeVariant = (eventType: string): "default" | "secondary" | "destructive" | "success" | "warning" => {
    switch (eventType) {
      case 'subscription_created':
      case 'subscription_reactivated':
      case 'payment_succeeded':
      case 'plan_changed': // Handle upgrades (will be determined by description)
        return 'success'; // Green for positive events
      case 'subscription_cancelled':
      case 'payment_failed':
        return 'destructive'; // Red for negative events
      case 'subscription_updated':
      case 'subscription_amount_changed':
        return 'secondary'; // Gray for neutral events
      default:
        return 'secondary';
    }
  };

  const getEventBadgeVariantByDescription = (eventType: string, description: string): "default" | "secondary" | "destructive" | "success" | "warning" => {
    // Special handling for plan_changed events based on description
    if (eventType === 'plan_changed') {
      if (description.toLowerCase().includes('downgraded')) {
        return 'warning'; // Orange for downgrades
      } else if (description.toLowerCase().includes('upgraded')) {
        return 'success'; // Green for upgrades
      }
    }

    // Fall back to the original logic
    return getEventBadgeVariant(eventType);
  };

  const formatEventType = (eventType: string, description: string = ''): string => {
    switch (eventType) {
      case 'subscription_created':
        return 'Created';
      case 'subscription_updated':
        return 'Updated';
      case 'subscription_amount_changed':
        return 'Amount Changed';
      case 'subscription_downgraded':
        return 'Downgrade';
      case 'subscription_cancelled':
        return 'Cancelled';
      case 'subscription_reactivated':
        return 'Reactivated';
      case 'payment_succeeded':
        return 'Payment Successful';
      case 'payment_failed':
        return 'Payment Failed';
      case 'plan_changed':
        // Determine if it's an upgrade or downgrade from the description
        if (description.toLowerCase().includes('downgraded')) {
          return 'Downgrade';
        } else if (description.toLowerCase().includes('upgraded')) {
          return 'Upgrade';
        } else {
          return 'Plan Changed';
        }
      default:
        return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const formatAmount = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={cn("wewrite-card", className)}>
        <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <Icon name="Loader" className="mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading subscription history...</p>
            </div>
          </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("wewrite-card", className)}>
        <div className="flex flex-col items-center gap-4 py-6">
          <Icon name="AlertCircle" size={48} className="text-destructive" />
          <div className="text-center">
            <p className="text-sm font-medium text-destructive mb-2">Failed to load subscription history</p>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
          </div>
          <Button onClick={fetchHistory} variant="secondary" size="sm">
            <Icon name="RefreshCw" size={16} className="mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("wewrite-card", className)}>
      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <Icon name="History" size={48} className="text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">No subscription history found</p>
            <p className="text-xs text-muted-foreground">
              Your subscription changes and payments will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((event) => (
            <div key={event.id} className="p-3 border border-border rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <Badge variant={getEventBadgeVariantByDescription(event.type, event.description)} className="text-xs">
                  {formatEventType(event.type, event.description)}
                </Badge>

                {/* Relative time with tooltip showing absolute date/time */}
                <div
                  className="tooltip-trigger text-xs text-muted-foreground cursor-help"
                  data-tooltip={`${event.timestamp.toLocaleDateString()} ${event.timestamp.toLocaleTimeString()}`}
                >
                  {formatRelativeTime(event.timestamp)}
                </div>
              </div>

              <p className="text-sm font-medium">{event.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
