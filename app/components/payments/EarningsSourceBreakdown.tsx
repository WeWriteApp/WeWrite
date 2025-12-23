"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { formatUsdCents } from '../../utils/formatCurrency';
import { useEarnings } from '../../contexts/EarningsContext';
import { toast } from '../ui/use-toast';
import { PillLink } from '../utils/PillLink';

interface PageEarning {
  pageId: string;
  pageTitle: string;
  totalEarnings: number;
  sponsorCount: number;
  sponsors: PageSponsorInfo[];
}

interface PageSponsorInfo {
  userId: string;
  username: string;
  amount: number;
}

interface SponsorInfo {
  userId: string;
  username: string;
  totalContribution: number;
  pageCount: number;
  pages: PageContribution[];
}

interface PageContribution {
  pageId: string;
  pageTitle: string;
  amount: number;
}

interface ReferralEarning {
  referredUserId: string;
  referredUsername: string;
  totalEarnings: number;
  payoutCount: number;
}

type BreakdownMode = 'pages' | 'sponsors' | 'referrals';

/**
 * EarningsSourceBreakdown - Shows where earnings are coming from
 *
 * Two modes:
 * - Pages: Shows which pages are earning the most
 * - Sponsors: Shows which users are contributing the most
 */
export default function EarningsSourceBreakdown() {
  const { earnings, loading } = useEarnings();
  const [mode, setMode] = useState<BreakdownMode>('pages');
  const [historicalEarnings, setHistoricalEarnings] = useState<any[]>([]);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [loadingHistorical, setLoadingHistorical] = useState(false);

  // Helper functions for card expansion
  const toggleCardExpansion = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const isCardExpanded = (cardId: string) => expandedCards.has(cardId);

  // Copy page link to clipboard
  const copyPageLink = async (pageId: string, pageTitle: string) => {
    try {
      const url = `${window.location.origin}/${pageId}`;
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: `Copied link for "${pageTitle}"`,
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast({
        title: "Copy failed",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    }
  };

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
  const { pageBreakdown, sponsorBreakdown, referralBreakdown } = useMemo(() => {
    console.log('[EarningsSourceBreakdown] Processing earnings data:', {
      earnings,
      pendingAllocations: earnings?.pendingAllocations,
      pendingAllocationsLength: earnings?.pendingAllocations?.length,
      historicalEarnings: historicalEarnings.length,
      availableBalance: earnings?.availableBalance,
      totalEarnings: earnings?.totalEarnings,
      hasEarnings: earnings?.hasEarnings,
      earningsKeys: earnings ? Object.keys(earnings) : null
    });

    // Combine current pending allocations with historical earnings data
    const allEarningsData: any[] = [];

    // Add current month pending allocations
    if (earnings?.pendingAllocations) {
      allEarningsData.push(...earnings.pendingAllocations);
    }

    // Add historical earnings data (for available balance sources)
    if (historicalEarnings.length > 0) {
      historicalEarnings.forEach(earning => {
        if (earning.allocations) {
          allEarningsData.push(...earning.allocations.map((allocation: any) => ({
            ...allocation,
            isHistorical: true
          })));
        }
      });
    }

    console.log('[EarningsSourceBreakdown] Combined earnings data:', allEarningsData.length);

    if (allEarningsData.length === 0) {
      console.log('[EarningsSourceBreakdown] No earnings data found (pending or historical)');
      return { pageBreakdown: [], sponsorBreakdown: [], referralBreakdown: [] };
    }

    // Separate referral allocations from page allocations
    const pageAllocations = allEarningsData.filter(a => a.resourceType !== 'referral');
    const referralAllocations = allEarningsData.filter(a => a.resourceType === 'referral');

    // Group by pages (excluding referrals)
    const pageMap = new Map<string, PageEarning>();
    const sponsorMap = new Map<string, SponsorInfo>();

    pageAllocations.forEach((allocation: any) => {
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
          amount
        });
        pageData.sponsorCount++;
      } else {
        const sponsor = pageData.sponsors.find(s => s.userId === userId)!;
        sponsor.amount += amount;
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

      // Find existing page contribution or create new one
      const existingPage = sponsorData.pages.find(p => p.pageId === pageId);
      if (existingPage) {
        existingPage.amount += amount;
      } else {
        sponsorData.pages.push({ pageId, pageTitle, amount });
        sponsorData.pageCount++;
      }
    });

    // Group referral allocations by referred user
    const referralMap = new Map<string, ReferralEarning>();
    referralAllocations.forEach((allocation: any) => {
      const referredUserId = allocation.fromUserId;
      const referredUsername = allocation.fromUsername || 'Anonymous';
      const amount = allocation.usdCents / 100;

      if (!referralMap.has(referredUserId)) {
        referralMap.set(referredUserId, {
          referredUserId,
          referredUsername,
          totalEarnings: 0,
          payoutCount: 0
        });
      }
      const referralData = referralMap.get(referredUserId)!;
      referralData.totalEarnings += amount;
      referralData.payoutCount++;
    });

    // Convert to arrays and sort
    const pageBreakdown = Array.from(pageMap.values())
      .sort((a, b) => b.totalEarnings - a.totalEarnings);

    const sponsorBreakdown = Array.from(sponsorMap.values())
      .sort((a, b) => b.totalContribution - a.totalContribution);

    const referralBreakdown = Array.from(referralMap.values())
      .sort((a, b) => b.totalEarnings - a.totalEarnings);

    return { pageBreakdown, sponsorBreakdown, referralBreakdown };
  }, [earnings?.pendingAllocations, historicalEarnings]);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        </div>

        {/* Loading cards */}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex justify-between items-center">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasEarnings = pageBreakdown.length > 0 || sponsorBreakdown.length > 0 || referralBreakdown.length > 0;
  const hasReferrals = referralBreakdown.length > 0;

  return (
    <div className="space-y-4">
      {/* Page Subheader */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Icon name="TrendingUp" size={20} className="text-green-600" />
          Earnings Sources
        </h2>

        {hasEarnings && (
          <div className="flex gap-1">
            <Button
              variant={mode === 'pages' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('pages')}
              className="flex items-center gap-1"
            >
              <Icon name="FileText" size={12} />
              Pages
            </Button>
            <Button
              variant={mode === 'sponsors' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('sponsors')}
              className="flex items-center gap-1"
            >
              <Icon name="Users" size={12} />
              Sponsors
            </Button>
            {hasReferrals && (
              <Button
                variant={mode === 'referrals' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode('referrals')}
                className="flex items-center gap-1"
              >
                <Icon name="UserPlus" size={12} />
                Referrals
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {!hasEarnings ? (
        <div className="text-center py-8 text-muted-foreground">
          <Icon name="TrendingUp" size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No current earnings sources</p>
          <p className="text-xs mt-1">Start writing pages to earn from supporters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mode === 'pages' ? (
            // Pages breakdown - Each page gets its own card
            pageBreakdown.map((page, index) => {
              const cardId = `page-${page.pageId}`;
              const isExpanded = isCardExpanded(cardId);

              return (
                <Card key={page.pageId} className="overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleCardExpansion(cardId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
                          <PillLink
                            href={`/${page.pageId}`}
                            pageId={page.pageId}
                            isPublic={true}
                            customOnClick={(e) => e.stopPropagation()}
                          >
                            {page.pageTitle}
                          </PillLink>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyPageLink(page.pageId, page.pageTitle);
                            }}
                          >
                            <Icon name="Copy" size={12} />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {page.sponsorCount} sponsor{page.sponsorCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-semibold text-green-600">
                            {formatUsdCents(page.totalEarnings * 100)}
                          </div>
                          <div className="text-xs text-muted-foreground">/month</div>
                        </div>
                        <Icon name="ChevronRight" size={16} className={`text-muted-foreground transition-transform duration-200 ${
                          isExpanded ? 'rotate-90' : 'rotate-0'
                        }`} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded content - Sponsor breakdown for this page */}
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}>
                    <div className="border-t border-neutral-15 bg-muted/20">
                      <div className="p-4">
                        <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                          Sponsors for this page
                        </h4>
                        <div className="space-y-2">
                          {page.sponsors.map((sponsor) => (
                            <div key={sponsor.userId} className="flex items-center justify-between py-2 px-3">
                              <div className="flex items-center gap-2">
                                <PillLink
                                  href={`/u/${sponsor.userId}`}
                                  isPublic={true}
                                >
                                  {sponsor.username}
                                </PillLink>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-green-600">
                                  {formatUsdCents((sponsor.amount || 0) * 100)}
                                </div>
                                <div className="text-xs text-muted-foreground">/month</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
            ) : mode === 'sponsors' ? (
              // Sponsors breakdown - Each sponsor gets its own card
              sponsorBreakdown.map((sponsor, index) => {
                const cardId = `sponsor-${sponsor.userId}`;
                const isExpanded = isCardExpanded(cardId);

                return (
                  <Card key={sponsor.userId} className="overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleCardExpansion(cardId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
                            <PillLink
                              href={`/u/${sponsor.userId}`}
                              isPublic={true}
                              customOnClick={(e) => e.stopPropagation()}
                            >
                              {sponsor.username}
                            </PillLink>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Supporting {sponsor.pageCount} page{sponsor.pageCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-semibold text-green-600">
                              {formatUsdCents(sponsor.totalContribution * 100)}
                            </div>
                            <div className="text-xs text-muted-foreground">/month</div>
                          </div>
                          <Icon name="ChevronRight" size={16} className={`text-muted-foreground transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : 'rotate-0'
                          }`} />
                        </div>
                      </div>
                    </div>

                    {/* Expanded content - Pages breakdown for this sponsor */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="border-t border-neutral-15 bg-muted/20">
                        <div className="p-4">
                          <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                            Pages supported by {sponsor.username}
                          </h4>
                          <div className="space-y-2">
                            {sponsor.pages.map((page) => (
                              <div key={page.pageId} className="flex items-center justify-between py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <PillLink
                                    href={`/${page.pageId}`}
                                    pageId={page.pageId}
                                    isPublic={true}
                                  >
                                    {page.pageTitle}
                                  </PillLink>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-semibold text-green-600">
                                    {formatUsdCents((page.amount || 0) * 100)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">/month</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : mode === 'referrals' ? (
              // Referrals breakdown - Each referred user gets their own card
              referralBreakdown.map((referral, index) => (
                <Card key={referral.referredUserId} className="overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
                          <Icon name="UserPlus" size={16} className="text-purple-500" />
                          <PillLink
                            href={`/u/${referral.referredUserId}`}
                            isPublic={true}
                          >
                            @{referral.referredUsername}
                          </PillLink>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {referral.payoutCount} payout{referral.payoutCount !== 1 ? 's' : ''} • 30% of platform fee
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-purple-600">
                          {formatUsdCents(referral.totalEarnings * 100)}
                        </div>
                        <div className="text-xs text-muted-foreground">earned</div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : null}

            {/* Summary */}
            <div className="pt-3 mt-3 border-t border-neutral-15">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {mode === 'pages'
                    ? `${pageBreakdown.length} earning page${pageBreakdown.length !== 1 ? 's' : ''}`
                    : mode === 'sponsors'
                    ? `${sponsorBreakdown.length} sponsor${sponsorBreakdown.length !== 1 ? 's' : ''}`
                    : `${referralBreakdown.length} referral${referralBreakdown.length !== 1 ? 's' : ''}`
                  }
                </span>
                <span className="font-medium">
                  {mode === 'referrals'
                    ? `Total: ${formatUsdCents(referralBreakdown.reduce((sum, r) => sum + r.totalEarnings, 0) * 100)}`
                    : `Total: ${formatUsdCents((earnings?.pendingBalance || 0) * 100)}/month`
                  }
                </span>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
