'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../providers/AuthProvider';
import NavPageLayout from '../../../components/layout/NavPageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { CheckCircle, Wallet, ArrowRight, CreditCard, Calendar } from 'lucide-react';
import { formatUsdCents, dollarsToCents } from '../../../utils/formatCurrency';
import Link from 'next/link';

interface SubscriptionData {
  id: string;
  amount: number;
  tier: string;
  status: string;
  nextBillingDate?: string;
}

export default function FundAccountSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const subscriptionId = searchParams.get('subscription');

  // Fetch subscription details
  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      if (!subscriptionId || !user) {
        setIsLoading(false);
        return;
      }

      try {
        // In a real implementation, you'd fetch the subscription details from your API
        // For now, we'll simulate this
        const response = await fetch(`/api/subscription/${subscriptionId}`);
        if (response.ok) {
          const data = await response.json();
          setSubscription(data);
        }
      } catch (error) {
        console.error('Error fetching subscription details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptionDetails();
  }, [subscriptionId, user]);

  // Redirect if no user
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center">
          <p>Loading subscription details...</p>
        </div>
      </div>
    );
  }

  return (
    <NavPageLayout>

      <div className="space-y-6">
        {/* Success message */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-green-800">
                  Account Funding Activated!
                </CardTitle>
                <CardDescription className="text-green-700">
                  You can now start supporting creators with direct USD payments
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Subscription details */}
        {subscription && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Funding Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Amount:</span>
                    <span className="font-semibold">
                      {formatUsdCents(dollarsToCents(subscription.amount))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan:</span>
                    <Badge variant="secondary">{subscription.tier}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {subscription.status}
                    </Badge>
                  </div>
                </div>
                
                {subscription.nextBillingDate && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Next billing date:</span>
                    </div>
                    <p className="font-semibold">
                      {new Date(subscription.nextBillingDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* What's next */}
        <Card>
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
            <CardDescription>
              Start supporting creators with your monthly funding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-primary/10 rounded-full mt-1">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                </div>
                <div>
                  <h4 className="font-medium">Explore Content</h4>
                  <p className="text-sm text-muted-foreground">
                    Browse pages and discover creators you want to support
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-1 bg-primary/10 rounded-full mt-1">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                </div>
                <div>
                  <h4 className="font-medium">Allocate Funds</h4>
                  <p className="text-sm text-muted-foreground">
                    Use the pledge bar on pages to allocate your monthly funds
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-1 bg-primary/10 rounded-full mt-1">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                </div>
                <div>
                  <h4 className="font-medium">Track Allocations</h4>
                  <p className="text-sm text-muted-foreground">
                    Monitor your spending and adjust allocations anytime
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild className="flex-1">
            <Link href="/">
              <ArrowRight className="h-4 w-4 mr-2" />
              Start Exploring Content
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="flex-1">
            <Link href="/settings/spend">
              <Wallet className="h-4 w-4 mr-2" />
              Manage Allocations
            </Link>
          </Button>
        </div>

        {/* Help text */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Need help getting started?{' '}
            <Link href="/support/getting-started" className="text-primary hover:underline">
              View our getting started guide
            </Link>
          </p>
        </div>
      </div>
    </NavPageLayout>
  );
}
