"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../providers/AuthProvider';
import NavPageLayout from '../components/layout/NavPageLayout';
import { Button } from '../components/ui/button';
import { useRouter } from 'next/navigation';
import { cn } from '../lib/utils';
import { LANDING_VERTICALS, getVerticalSlugs } from '../constants/landing-verticals';

interface ReferralStats {
  totalReferrals: number;
  recentReferrals: Array<{
    username: string;
    joinedAt: string;
    referralSource?: string; // Landing page vertical (e.g., 'general', 'writers')
  }>;
}

interface ReferralRevenue {
  totalReferrals: number;
  totalPayoutsCents: number;
  totalFeesEarnedCents: number;
  referralSharePercent: number;
  platformFeePercent: number;
  referralDetails: Array<{
    username: string;
    totalPayoutsCents: number;
    feesEarnedCents: number;
    payoutCount: number;
  }>;
}

/**
 * Invite Friends Page
 *
 * Dashboard showing referral stats and revenue earned from referrals.
 * Users earn 30% of the payout fee from users they refer.
 */
export default function InviteFriendsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [copiedVertical, setCopiedVertical] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>('general');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [revenue, setRevenue] = useState<ReferralRevenue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to login if not authenticated (only after auth has finished loading)
  useEffect(() => {
    if (mounted && !authLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [mounted, authLoading, isAuthenticated, router]);

  // Fetch referral data
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid) return;

      try {
        const [statsRes, revenueRes] = await Promise.all([
          fetch(`/api/user/referral-stats?userId=${user.uid}`),
          fetch(`/api/user/referral-revenue?userId=${user.uid}`),
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (revenueRes.ok) {
          const revenueData = await revenueRes.json();
          setRevenue(revenueData);
        }
      } catch (error) {
        console.error('Error fetching referral data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.uid) {
      fetchData();
    }
  }, [user?.uid]);

  // Copy vertical-specific referral link (uses username for nicer URLs)
  const copyVerticalLink = async (verticalSlug: string) => {
    if (!user?.uid) return;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    // Use username if available, fallback to UID for backwards compatibility
    const refCode = user.username || user.uid;
    const link = verticalSlug === 'general'
      ? `${baseUrl}/welcome?ref=${refCode}`
      : `${baseUrl}/welcome/${verticalSlug}?ref=${refCode}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedVertical(verticalSlug);
      setTimeout(() => setCopiedVertical(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Get icon for each vertical
  const getVerticalIcon = (slug: string) => {
    const icons: Record<string, React.ReactNode> = {
      general: <Icon name="Globe" size={20} />,
      writers: <Icon name="PenLine" size={20} />,
      journalists: <Icon name="Newspaper" size={20} />,
      homeschoolers: <Icon name="GraduationCap" size={20} />,
      debaters: <Icon name="Megaphone" size={20} />,
      researchers: <Icon name="FlaskConical" size={20} />,
      'film-critics': <Icon name="Film" size={20} />,
      'food-critics': <Icon name="UtensilsCrossed" size={20} />,
    };
    return icons[slug] || <Icon name="Globe" size={20} />;
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Show progressive loading state during hydration or auth loading
  if (!mounted || authLoading) {
    return (
      <NavPageLayout loading={true} loadingFallback={
        <div>
          <div className="text-center mb-8">
            <div className="h-10 w-48 bg-muted rounded-md mx-auto mb-4 animate-pulse" />
            <div className="h-6 w-96 bg-muted rounded-md mx-auto animate-pulse" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="p-6 border border-border rounded-2xl">
                <div className="h-8 bg-muted rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      } />
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <NavPageLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Icon name="Lock" size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            You need to sign in to view your referral dashboard.
          </p>
          <Button onClick={() => router.push('/auth/login')}>
            Sign In
          </Button>
        </div>
      </NavPageLayout>
    );
  }

  const totalReferrals = stats?.totalReferrals || revenue?.totalReferrals || 0;
  const totalEarned = revenue?.totalFeesEarnedCents || 0;

  return (
    <NavPageLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-3xl font-bold">Invite Friends</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Share WeWrite with friends and earn 30% of the payout fee when they cash out their earnings.
        </p>
      </div>

      {/* Stats Cards - fit to page width */}
      <div className="mb-8">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="p-3 sm:p-6 border border-border rounded-2xl bg-card">
            <p className="text-xs sm:text-sm text-muted-foreground">Invited</p>
            <p className="text-lg sm:text-2xl font-bold">
              {loading ? (
                <span className="inline-block w-8 h-6 bg-muted rounded animate-pulse" />
              ) : (
                totalReferrals
              )}
            </p>
          </div>

          <div className="p-3 sm:p-6 border border-border rounded-2xl bg-card">
            <p className="text-xs sm:text-sm text-muted-foreground">Earnings</p>
            <p className="text-lg sm:text-2xl font-bold">
              {loading ? (
                <span className="inline-block w-16 h-6 bg-muted rounded animate-pulse" />
              ) : (
                formatCurrency(totalEarned)
              )}
            </p>
          </div>

          <div className="p-3 sm:p-6 border border-border rounded-2xl bg-card">
            <p className="text-xs sm:text-sm text-muted-foreground">Your Share</p>
            <p className="text-lg sm:text-2xl font-bold">30%</p>
          </div>
        </div>
      </div>

      {/* Recent Referrals */}
      {stats && stats.recentReferrals.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Recent Sign-ups</h2>
          <div className="space-y-3">
            {stats.recentReferrals.map((referral, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-border rounded-xl bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {referral.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{referral.username}</span>
                    {referral.referralSource && referral.referralSource !== 'general' && (
                      <span className="text-xs text-muted-foreground">
                        via {LANDING_VERTICALS[referral.referralSource]?.name || referral.referralSource}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatDate(referral.joinedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Details */}
      {revenue && revenue.referralDetails.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Revenue Breakdown</h2>
          <div className="space-y-3">
            {revenue.referralDetails.map((detail, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border border-border rounded-xl bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                    <Icon name="DollarSign" size={20} className="text-green-500" />
                  </div>
                  <div>
                    <span className="font-medium">{detail.username}</span>
                    <p className="text-sm text-muted-foreground">
                      {detail.payoutCount} payout{detail.payoutCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-500">
                    +{formatCurrency(detail.feesEarnedCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    from {formatCurrency(detail.totalPayoutsCents)} in payouts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && totalReferrals === 0 && (
        <EmptyState
          icon="UserPlus"
          title="No Referrals Yet"
          description="Share your invite links with friends to start earning. When they sign up and cash out their earnings, you'll receive 30% of the payout fee."
          size="lg"
        />
      )}

      {/* General Landing Page Section */}
      <div className="mt-8 mb-8">
        <h2 className="text-xl font-semibold mb-4">
          General landing page
        </h2>
        <div
          className={cn(
            "p-4 border border-border rounded-xl bg-card transition-all cursor-pointer",
            expandedCard === 'general' ? "ring-2 ring-primary" : "hover:bg-muted/50"
          )}
          onClick={() => setExpandedCard(expandedCard === 'general' ? null : 'general')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              {getVerticalIcon('general')}
            </div>
            <div className="flex-1">
              <p className="font-medium">General</p>
              <p className="text-xs text-muted-foreground">/welcome</p>
            </div>
            <Icon name="ChevronDown" size={20} className={cn(
                "text-muted-foreground transition-transform duration-200",
                expandedCard === 'general' && "rotate-180"
              )} />
          </div>
          {/* Expanded actions */}
          <div
            className={cn(
              "grid transition-all duration-200 ease-out",
              expandedCard === 'general' ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden">
              <div className="flex gap-2 mt-4 pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/welcome');
                  }}
                >
                  <Icon name="ExternalLink" size={16} className="mr-2" />
                  Preview
                </Button>
                <Button
                  variant={copiedVertical === 'general' ? 'success' : 'default'}
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyVerticalLink('general');
                  }}
                >
                  {copiedVertical === 'general' ? (
                    <>
                      <Icon name="Check" size={16} className="mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Icon name="Copy" size={16} className="mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Targeted Landing Pages Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          Targeted landing pages
        </h2>
        <p className="text-muted-foreground mb-6">
          Share links customized for specific audiences. Click on a card to see options.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Vertical-specific Landing Pages */}
          {Object.entries(LANDING_VERTICALS)
            .filter(([slug]) => slug !== 'general')
            .map(([slug, vertical]) => (
            <div
              key={slug}
              className={cn(
                "p-4 border border-border rounded-xl bg-card transition-all cursor-pointer",
                expandedCard === slug ? "ring-2 ring-primary" : "hover:bg-muted/50"
              )}
              onClick={() => setExpandedCard(expandedCard === slug ? null : slug)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  {getVerticalIcon(slug)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{vertical.name}</p>
                  <p className="text-xs text-muted-foreground">/welcome/{slug}</p>
                </div>
                <Icon name="ChevronDown" size={20} className={cn(
                    "text-muted-foreground transition-transform duration-200",
                    expandedCard === slug && "rotate-180"
                  )} />
              </div>
              {/* Expanded actions */}
              <div
                className={cn(
                  "grid transition-all duration-200 ease-out",
                  expandedCard === slug ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="flex gap-2 mt-4 pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/welcome/${slug}`);
                      }}
                    >
                      <Icon name="ExternalLink" size={16} className="mr-2" />
                      Preview
                    </Button>
                    <Button
                      variant={copiedVertical === slug ? 'success' : 'default'}
                      size="sm"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyVerticalLink(slug);
                      }}
                    >
                      {copiedVertical === slug ? (
                        <>
                          <Icon name="Check" size={16} className="mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Icon name="Copy" size={16} className="mr-2" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-12 p-6 border border-border rounded-2xl bg-card">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Icon name="UserPlus" size={20} className="text-primary" />
          How Referral Earnings Work
        </h2>
        <div className="space-y-3 text-muted-foreground">
          <p>
            When someone signs up using your referral link, you become their referrer.
          </p>
          <p>
            WeWrite takes a 10% fee when writers cash out their earnings.
            As a referrer, you receive <strong className="text-foreground">30% of that fee</strong> (3% of the total payout).
          </p>
          <p>
            For example, if your referral cashes out $100:
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>WeWrite's fee: $10 (10%)</li>
            <li>Your referral earnings: $3 (30% of $10)</li>
            <li>Referral receives: $90</li>
          </ul>
          <p className="mt-4">
            The more active writers you refer, the more you earn!
          </p>
        </div>
      </div>
    </NavPageLayout>
  );
}
