"use client";

import React, { useState, useMemo } from 'react';
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

  // Process the pending allocations data
  const { pageBreakdown, sponsorBreakdown } = useMemo(() => {
    console.log('[EarningsSourceBreakdown] Processing earnings data:', {
      earnings,
      pendingAllocations: earnings?.pendingAllocations,
      pendingAllocationsLength: earnings?.pendingAllocations?.length
    });

    if (!earnings?.pendingAllocations) {
      console.log('[EarningsSourceBreakdown] No pending allocations found');
      return { pageBreakdown: [], sponsorBreakdown: [] };
    }

    // Group by pages
    const pageMap = new Map<string, PageEarning>();
    const sponsorMap = new Map<string, SponsorInfo>();

    earnings.pendingAllocations.forEach((allocation: any) => {
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
  }, [earnings?.pendingAllocations]);

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
