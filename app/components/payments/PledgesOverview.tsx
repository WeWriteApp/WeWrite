"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Heart, ExternalLink, Settings, DollarSign, TrendingUp } from 'lucide-react';
import { useFeatureFlag } from '../../utils/feature-flags';
import { listenToUserPledges } from '../../firebase/subscription';
import { getDocById } from '../../firebase/database';
import Link from 'next/link';

interface Pledge {
  id: string;
  pageId: string;
  amount: number;
  createdAt: any;
  pageTitle?: string;
  authorUsername?: string;
  authorDisplayName?: string;
}

export function PledgesOverview() {
  const { user } = useAuth();
  const isPaymentsEnabled = useFeatureFlag('payments', user?.email);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // If payments feature flag is disabled, don't render anything
  if (!isPaymentsEnabled) {
    return null;
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = listenToUserPledges(user.uid, async (pledgesData) => {
      try {
        setError(null);
        
        if (!pledgesData || pledgesData.length === 0) {
          setPledges([]);
          setLoading(false);
          return;
        }

        // Fetch page details for each pledge
        const pledgesWithDetails = await Promise.all(
          pledgesData.map(async (pledge) => {
            try {
              const pageDoc = await getDocById('pages', pledge.pageId);
              if (pageDoc) {
                return {
                  ...pledge,
                  pageTitle: pageDoc.title || 'Untitled Page',
                  authorUsername: pageDoc.username,
                  authorDisplayName: pageDoc.displayName,
                };
              }
              return {
                ...pledge,
                pageTitle: 'Unknown Page',
              };
            } catch (error) {
              console.error('Error fetching page details for pledge:', error);
              return {
                ...pledge,
                pageTitle: 'Unknown Page',
              };
            }
          })
        );

        setPledges(pledgesWithDetails);
      } catch (error) {
        console.error('Error processing pledges:', error);
        setError('Failed to load pledge details');
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const totalPledgedAmount = pledges.reduce((sum, pledge) => sum + pledge.amount, 0);
  const activePledgesCount = pledges.length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Your Pledges
          </CardTitle>
          <CardDescription>Overview of pages you're supporting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Your Pledges
        </CardTitle>
        <CardDescription>Overview of pages you're supporting</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-center py-4 text-red-600">
            <p>{error}</p>
          </div>
        )}

        {pledges.length === 0 ? (
          <div className="text-center py-6">
            <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No pledges yet</h3>
            <p className="text-muted-foreground mb-4">
              Start supporting pages you love by visiting them and making a pledge.
            </p>
            <Button variant="outline" asChild>
              <Link href="/">Browse Pages</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Total Monthly</span>
                </div>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalPledgedAmount)}</p>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Active Pledges</span>
                </div>
                <p className="text-xl font-bold text-blue-600">{activePledgesCount}</p>
              </div>
            </div>

            {/* Top Pledges (show max 3) */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Recent Pledges</h4>
              {pledges
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 3)
                .map((pledge) => (
                  <div
                    key={pledge.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/${pledge.pageId}`}
                          className="font-medium text-sm hover:text-primary truncate"
                        >
                          {pledge.pageTitle}
                        </Link>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </div>
                      {pledge.authorUsername && (
                        <p className="text-xs text-muted-foreground">
                          by @{pledge.authorUsername}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {formatCurrency(pledge.amount)}/mo
                      </Badge>
                    </div>
                  </div>
                ))}

              {/* Show count if there are more pledges */}
              {pledges.length > 3 && (
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">
                    +{pledges.length - 3} more pledge{pledges.length - 3 !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Manage Button */}
            <div className="pt-2">
              <Button variant="outline" className="w-full" asChild>
                <Link href="/settings/subscription">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage All Pledges
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
