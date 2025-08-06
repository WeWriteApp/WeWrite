"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { FileText, Users, TrendingUp } from 'lucide-react';
import { formatUsdCents } from '../../utils/formatCurrency';
import { useUserEarnings } from '../../hooks/useUserEarnings';

interface PageEarning {
  pageId: string;
  pageTitle: string;
  totalEarnings: number;
  sponsorCount: number;
  sponsors: SponsorInfo[];
}

interface SponsorInfo {
  userId: string;
  username: string;
  totalContribution: number;
  pageCount: number;
  pages: string[];
}

type BreakdownMode = 'pages' | 'sponsors';

/**
 * EarningsSourceBreakdown - Shows where earnings are coming from
 * 
 * Two modes:
 * - Pages: Shows which pages are earning the most
 * - Sponsors: Shows which users are contributing the most
 */
export default function EarningsSourceBreakdown() {
  const { earnings, loading } = useUserEarnings();
  const [mode, setMode] = useState<BreakdownMode>('pages');
  const [historicalEarnings, setHistoricalEarnings] = useState<any[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);

  // Load historical earnings data to show sources for available balance
  useEffect(() => {
    if (earnings?.availableBalance > 0 && !loadingHistorical) {
      setLoadingHistorical(true);
      fetch('/api/usd/earnings')
        .then(res => res.json())
        .then(data => {
          console.log('[EarningsSourceBreakdown] Historical earnings data:', data);
          if (data.success && data.data?.earnings) {
            setHistoricalEarnings(data.data.earnings);
          }
        })
        .catch(err => {
          console.error('[EarningsSourceBreakdown] Error loading historical earnings:', err);
        })
        .finally(() => {
          setLoadingHistorical(false);
        });
    }
  }, [earnings?.availableBalance, loadingHistorical]);

  // Process both pending allocations AND historical earnings data
  const { pageBreakdown, sponsorBreakdown } = useMemo(() => {
    console.log('[EarningsSourceBreakdown] Processing earnings data:', {
      earnings,
      pendingAllocations: earnings?.pendingAllocations,
      pendingAllocationsLength: earnings?.pendingAllocations?.length,
      historicalEarnings: historicalEarnings.length,
      availableBalance: earnings?.availableBalance,
      totalEarnings: earnings?.totalEarnings
    });

    // Combine current pending allocations with historical earnings data
    const allEarningsData = [];

    // Add current month pending allocations
    if (earnings?.pendingAllocations) {
      allEarningsData.push(...earnings.pendingAllocations);
    }

    // Add historical earnings data (for available balance sources)
    if (historicalEarnings.length > 0) {
      historicalEarnings.forEach(earning => {
        if (earning.allocations) {
          allEarningsData.push(...earning.allocations.map(allocation => ({
            ...allocation,
            isHistorical: true
          })));
        }
      });
    }

    console.log('[EarningsSourceBreakdown] Combined earnings data:', allEarningsData.length);

    if (allEarningsData.length === 0) {
      console.log('[EarningsSourceBreakdown] No earnings data found (pending or historical)');
      return { pageBreakdown: [], sponsorBreakdown: [] };
    }

    // Group by pages
    const pageMap = new Map<string, PageEarning>();
    const sponsorMap = new Map<string, SponsorInfo>();

    allEarningsData.forEach((allocation: any) => {
      const pageId = allocation.resourceId;
      const pageTitle = allocation.pageTitle || allocation.resourceTitle || 'Untitled Page';
      const userId = allocation.fromUserId || allocation.userId;
      const username = allocation.fromUsername || allocation.username || 'Anonymous';
      const amount = allocation.usdCents / 100;

      // Update page breakdown
      if (!pageMap.has(pageId)) {
        pageMap.set(pageId, {
          pageId,
          pageTitle,
          totalEarnings: 0,
          sponsorCount: 0,
          sponsors: []
        });
      }
      const pageData = pageMap.get(pageId)!;
      pageData.totalEarnings += amount;
      
      // Add sponsor to page if not already there
      if (!pageData.sponsors.find(s => s.userId === userId)) {
        pageData.sponsors.push({
          userId,
          username,
          totalContribution: amount,
          pageCount: 1,
          pages: [pageTitle]
        });
        pageData.sponsorCount++;
      } else {
        const sponsor = pageData.sponsors.find(s => s.userId === userId)!;
        sponsor.totalContribution += amount;
      }

      // Update sponsor breakdown
      if (!sponsorMap.has(userId)) {
        sponsorMap.set(userId, {
          userId,
          username,
          totalContribution: 0,
          pageCount: 0,
          pages: []
        });
      }
      const sponsorData = sponsorMap.get(userId)!;
      sponsorData.totalContribution += amount;
      
      if (!sponsorData.pages.includes(pageTitle)) {
        sponsorData.pages.push(pageTitle);
        sponsorData.pageCount++;
      }
    });

    // Convert to arrays and sort
    const pageBreakdown = Array.from(pageMap.values())
      .sort((a, b) => b.totalEarnings - a.totalEarnings);
    
    const sponsorBreakdown = Array.from(sponsorMap.values())
      .sort((a, b) => b.totalContribution - a.totalContribution);

    return { pageBreakdown, sponsorBreakdown };
  }, [earnings?.pendingAllocations, historicalEarnings]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasEarnings = pageBreakdown.length > 0 || sponsorBreakdown.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Earnings Sources
          </CardTitle>
          
          {hasEarnings && (
            <div className="flex gap-1">
              <Button
                variant={mode === 'pages' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('pages')}
                className="flex items-center gap-1"
              >
                <FileText className="h-3 w-3" />
                Pages
              </Button>
              <Button
                variant={mode === 'sponsors' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('sponsors')}
                className="flex items-center gap-1"
              >
                <Users className="h-3 w-3" />
                Sponsors
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {!hasEarnings ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No current earnings sources</p>
            <p className="text-xs mt-1">Start writing pages to earn from supporters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mode === 'pages' ? (
              // Pages breakdown
              pageBreakdown.map((page, index) => (
                <div key={page.pageId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
                      <h4 className="font-medium truncate">{page.pageTitle}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {page.sponsorCount} sponsor{page.sponsorCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      {formatUsdCents(page.totalEarnings * 100)}
                    </div>
                    <div className="text-xs text-muted-foreground">/month</div>
                  </div>
                </div>
              ))
            ) : (
              // Sponsors breakdown
              sponsorBreakdown.map((sponsor, index) => (
                <div key={sponsor.userId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
                      <h4 className="font-medium truncate">{sponsor.username}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supporting {sponsor.pageCount} page{sponsor.pageCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      {formatUsdCents(sponsor.totalContribution * 100)}
                    </div>
                    <div className="text-xs text-muted-foreground">/month</div>
                  </div>
                </div>
              ))
            )}
            
            {/* Summary */}
            <div className="pt-3 mt-3 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {mode === 'pages' 
                    ? `${pageBreakdown.length} earning page${pageBreakdown.length !== 1 ? 's' : ''}`
                    : `${sponsorBreakdown.length} sponsor${sponsorBreakdown.length !== 1 ? 's' : ''}`
                  }
                </span>
                <span className="font-medium">
                  Total: {formatUsdCents((earnings?.pendingBalance || 0) * 100)}/month
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
