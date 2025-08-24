'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  History,
  Loader2,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../providers/AuthProvider';

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



  const getEventBadgeVariant = (eventType: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (eventType) {
      case 'subscription_created':
      case 'subscription_reactivated':
      case 'payment_succeeded':
        return 'default';
      case 'subscription_updated':
      case 'subscription_amount_changed':
      case 'subscription_downgraded':
        return 'secondary';
      case 'subscription_cancelled':
      case 'payment_failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const formatEventType = (eventType: string): string => {
    switch (eventType) {
      case 'subscription_created':
        return 'Subscription Created';
      case 'subscription_updated':
        return 'Subscription Updated';
      case 'subscription_amount_changed':
        return 'Amount Changed';
      case 'subscription_downgraded':
        return 'Downgraded';
      case 'subscription_cancelled':
        return 'Cancelled';
      case 'subscription_reactivated':
        return 'Reactivated';
      case 'payment_succeeded':
        return 'Payment Successful';
      case 'payment_failed':
        return 'Payment Failed';
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
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Subscription History
          </CardTitle>
          <CardDescription>
            Complete record of your WeWrite subscription changes and payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading subscription history...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Subscription History
          </CardTitle>
          <CardDescription>
            Complete record of your WeWrite subscription changes and payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <p className="text-sm font-medium text-destructive mb-2">Failed to load subscription history</p>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
            </div>
            <Button onClick={fetchHistory} variant="secondary" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Subscription History
        </CardTitle>
        <CardDescription>
          Complete record of your WeWrite subscription changes and payments over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <History className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">No subscription history found</p>
              <p className="text-xs text-muted-foreground">
                Your subscription changes and payments will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((event) => (
              <div key={event.id} className="p-4 border-theme-strong rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={getEventBadgeVariant(event.type)} className="text-xs">
                      {formatEventType(event.type)}
                    </Badge>

                    {/* Show subscription amount for all events */}
                    {event.details.amount && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                        <DollarSign className="h-3 w-3" />
                        {formatAmount(event.details.amount, event.details.currency)}/month
                      </span>
                    )}

                    {/* Show amount change for upgrade/downgrade events */}
                    {event.details.oldAmount && event.details.newAmount && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded">
                        <DollarSign className="h-3 w-3" />
                        {formatAmount(event.details.oldAmount)} → {formatAmount(event.details.newAmount)}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium mb-2">{event.description}</p>

                <div className="text-xs text-muted-foreground">
                  {event.timestamp.toLocaleDateString()} {event.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
