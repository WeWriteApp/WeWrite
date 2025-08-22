"use client";

/**
 * @deprecated This component is deprecated and will be removed in a future version.
 * Use subscription history components instead for USD-based purchase history.
 *
 * Legacy token purchase history - replaced by USD system.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  History,
  CreditCard,
  CheckCircle,
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  PauseCircle,
  PlayCircle,
  DollarSign,
  ExternalLink,
  Calendar,
  AlertCircle,
  ArrowLeftCircle
} from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface SubscriptionHistoryEvent {
  id: string;
  type: 'subscription_created' | 'subscription_updated' | 'subscription_cancelled' | 'subscription_reactivated' | 'payment_succeeded' | 'payment_failed' | 'payment_recovered' | 'plan_changed' | 'refund_issued';
  timestamp: Date;
  description: string;
  details: {
    oldValue?: any;
    newValue?: any;
    amount?: number;
    currency?: string;
    stripeEventId?: string;
    failureReason?: string;
    failureCount?: number;
    failureType?: string;
    previousFailureCount?: number;
    refundReason?: string;
    refundStatus?: string;
    metadata?: Record<string, any>;
  };
  source: 'stripe' | 'system' | 'user';
}

interface SubscriptionHistoryProps {
  className?: string;
}

export default function TokenPurchaseHistory({ className = '' }: SubscriptionHistoryProps) {
  const [history, setHistory] = useState<SubscriptionHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, []);

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
      setError(err instanceof Error ? err.message : 'Failed to load history');
      toast({
        title: "Error",
        description: "Failed to load subscription history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'subscription_created':
        return <PlayCircle className="h-4 w-4 text-green-500" />;
      case 'subscription_cancelled':
        return <PauseCircle className="h-4 w-4 text-red-500" />;
      case 'subscription_reactivated':
        return <PlayCircle className="h-4 w-4 text-green-500" />;
      case 'subscription_updated':
      case 'plan_changed':
        return <ArrowUpCircle className="h-4 w-4 text-primary" />;
      case 'payment_succeeded':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'payment_failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'payment_recovered':
        return <CheckCircle className="h-4 w-4 text-orange-500" />;
      case 'refund_issued':
        return <ArrowLeftCircle className="h-4 w-4 text-orange-600" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventBadgeVariant = (type: string) => {
    switch (type) {
      case 'subscription_created':
      case 'subscription_reactivated':
      case 'payment_succeeded':
        return 'default';
      case 'subscription_cancelled':
      case 'payment_failed':
        return 'destructive';
      case 'payment_recovered':
        return 'secondary';
      case 'subscription_updated':
      case 'plan_changed':
        return 'secondary';
      case 'refund_issued':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatEventType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatAmount = (amount?: number, currency?: string) => {
    if (!amount) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
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
            Loading your subscription and payment history...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
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
            Failed to load subscription history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <Button onClick={fetchHistory} variant="outline" size="sm">
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
          Complete audit log of your subscription changes and payments
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <History className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              No subscription history found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-4 border-theme-strong rounded-lg">
                <div className="flex-shrink-0 mt-0.5">
                  {getEventIcon(event.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getEventBadgeVariant(event.type)} className="text-xs">
                      {formatEventType(event.type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                  
                  <p className="text-sm font-medium mb-1">{event.description}</p>

                  {/* Enhanced payment failure details */}
                  {event.type === 'payment_failed' && (
                    <div className="mt-2 p-3 bg-destructive/10 border-theme-medium rounded-md" style={{ borderColor: 'hsl(var(--destructive) / 0.2)' }}>
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-destructive mb-1">
                            Payment Failed - Action Required
                          </p>
                          {event.details.failureReason && (
                            <p className="text-xs text-destructive/80 mb-2">
                              <strong>Reason:</strong> {event.details.failureReason}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3 text-xs">
                            {event.details.failureCount && (
                              <span className="text-destructive font-medium">
                                Attempt #{event.details.failureCount}
                              </span>
                            )}
                            {event.details.failureType && (
                              <span className="text-muted-foreground">
                                Type: {event.details.failureType.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Enhanced payment recovery details */}
                  {event.type === 'payment_recovered' && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/20 border-theme-medium rounded-md" style={{ borderColor: 'hsl(120 60% 50% / 0.3)' }}>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-green-800 mb-1">
                            Payment Recovered Successfully
                          </p>
                          {event.details.previousFailureCount && (
                            <p className="text-xs text-green-700">
                              Resolved after {event.details.previousFailureCount} failed attempt{event.details.previousFailureCount > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Refund details */}
                  {event.type === 'refund_issued' && (
                    <div className="mt-2 p-3 bg-orange-50 dark:bg-orange-950/20 border-theme-medium rounded-md" style={{ borderColor: 'hsl(30 80% 50% / 0.3)' }}>
                      <div className="flex items-start gap-2">
                        <ArrowLeftCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-orange-800 mb-1">
                            Refund Issued by WeWrite
                          </p>
                          {event.details.refundReason && (
                            <p className="text-xs text-orange-700 mb-2">
                              <strong>Reason:</strong> {event.details.refundReason}
                            </p>
                          )}
                          {event.details.refundStatus && (
                            <p className="text-xs text-orange-700">
                              <strong>Status:</strong> {event.details.refundStatus}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {event.timestamp.toLocaleDateString()} {event.timestamp.toLocaleTimeString()}
                    </span>
                    
                    {event.details.amount && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatAmount(event.details.amount, event.details.currency)}
                      </span>
                    )}
                    
                    <Badge variant="outline" className="text-xs">
                      {event.source}
                    </Badge>
                  </div>

                  {/* Additional details */}
                  {event.details.metadata?.hostedInvoiceUrl && (
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => window.open(event.details.metadata?.hostedInvoiceUrl, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Invoice
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
