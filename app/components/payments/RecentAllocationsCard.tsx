"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';
import { formatCurrency } from '../../utils/formatCurrency';
import PillLink from '../utils/PillLink';
import { UsernameBadge } from '../ui/UsernameBadge';

interface Allocation {
  id?: string;
  fromUserId: string;
  fromUsername?: string;
  resourceType: 'page' | 'user_bio' | 'group' | string;
  resourceId: string;
  resourceTitle?: string;
  tokens: number;
  usdValue?: number;
}

interface RecentAllocationsCardProps {
  allocations: Allocation[];
  className?: string;
}

type ViewMode = 'top-pages' | 'top-supporters';

interface PageGroup {
  resourceId: string;
  resourceTitle?: string;
  resourceType: string;
  totalTokens: number;
  totalUsdValue: number;
  supporterCount: number;
  supporters: Array<{
    fromUserId: string;
    fromUsername?: string;
    tokens: number;
    usdValue: number;
  }>;
}

interface SupporterGroup {
  fromUserId: string;
  fromUsername?: string;
  totalTokens: number;
  totalUsdValue: number;
  pageCount: number;
  pages: Array<{
    resourceId: string;
    resourceTitle?: string;
    resourceType: string;
    tokens: number;
    usdValue: number;
  }>;
}

export default function RecentAllocationsCard({ allocations, className = "" }: RecentAllocationsCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('top-pages');

  // Group allocations by page
  const pageGroups = useMemo(() => {
    const groups = new Map<string, PageGroup>();

    allocations.forEach(allocation => {
      const key = allocation.resourceId;
      const usdValue = allocation.usdValue || (allocation.tokens * 0.1);

      if (!groups.has(key)) {
        groups.set(key, {
          resourceId: allocation.resourceId,
          resourceTitle: allocation.resourceTitle,
          resourceType: allocation.resourceType,
          totalTokens: 0,
          totalUsdValue: 0,
          supporterCount: 0,
          supporters: []
        });
      }

      const group = groups.get(key)!;
      group.totalTokens += allocation.tokens;
      group.totalUsdValue += usdValue;

      // Add supporter if not already present
      const existingSupporterIndex = group.supporters.findIndex(s => s.fromUserId === allocation.fromUserId);
      if (existingSupporterIndex >= 0) {
        group.supporters[existingSupporterIndex].tokens += allocation.tokens;
        group.supporters[existingSupporterIndex].usdValue += usdValue;
      } else {
        group.supporters.push({
          fromUserId: allocation.fromUserId,
          fromUsername: allocation.fromUsername,
          tokens: allocation.tokens,
          usdValue: usdValue
        });
        group.supporterCount++;
      }
    });

    // Sort by total tokens (highest first)
    return Array.from(groups.values()).sort((a, b) => b.totalTokens - a.totalTokens);
  }, [allocations]);

  // Group allocations by supporter
  const supporterGroups = useMemo(() => {
    const groups = new Map<string, SupporterGroup>();

    allocations.forEach(allocation => {
      const key = allocation.fromUserId;
      const usdValue = allocation.usdValue || (allocation.tokens * 0.1);

      if (!groups.has(key)) {
        groups.set(key, {
          fromUserId: allocation.fromUserId,
          fromUsername: allocation.fromUsername,
          totalTokens: 0,
          totalUsdValue: 0,
          pageCount: 0,
          pages: []
        });
      }

      const group = groups.get(key)!;
      group.totalTokens += allocation.tokens;
      group.totalUsdValue += usdValue;

      // Add page if not already present
      const existingPageIndex = group.pages.findIndex(p => p.resourceId === allocation.resourceId);
      if (existingPageIndex >= 0) {
        group.pages[existingPageIndex].tokens += allocation.tokens;
        group.pages[existingPageIndex].usdValue += usdValue;
      } else {
        group.pages.push({
          resourceId: allocation.resourceId,
          resourceTitle: allocation.resourceTitle,
          resourceType: allocation.resourceType,
          tokens: allocation.tokens,
          usdValue: usdValue
        });
        group.pageCount++;
      }
    });

    // Sort by total tokens (highest first)
    return Array.from(groups.values()).sort((a, b) => b.totalTokens - a.totalTokens);
  }, [allocations]);

  const displayData = viewMode === 'top-pages' ? pageGroups.slice(0, 5) : supporterGroups.slice(0, 5);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Clock" size={20} />
          Recent Allocations
        </CardTitle>
        <CardDescription>
          Latest token allocations from supporters
        </CardDescription>
        <div className="flex gap-2 mt-2">
          <Button
            variant={viewMode === 'top-pages' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('top-pages')}
          >
            Top Pages
          </Button>
          <Button
            variant={viewMode === 'top-supporters' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('top-supporters')}
          >
            Top Supporters
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {viewMode === 'top-pages' ? (
            // Top Pages Mode
            pageGroups.slice(0, 5).map((pageGroup) => (
              <div key={pageGroup.resourceId} className="flex items-center justify-between p-3 rounded-lg border-theme-strong">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {pageGroup.resourceType === 'page' ? (
                      <PillLink
                        href={`/${pageGroup.resourceId}`}
                        className="text-sm"
                      >
                        {pageGroup.resourceTitle || pageGroup.resourceId}
                      </PillLink>
                    ) : (
                      <span className="font-medium text-sm">
                        {pageGroup.resourceType}: {pageGroup.resourceId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{pageGroup.totalTokens} tokens</span>
                    <span>•</span>
                    <span>{pageGroup.supporterCount} supporter{pageGroup.supporterCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(pageGroup.totalUsdValue)}</div>
                </div>
              </div>
            ))
          ) : (
            // Top Supporters Mode
            supporterGroups.slice(0, 5).map((supporterGroup) => (
              <div key={supporterGroup.fromUserId} className="flex items-center justify-between p-3 rounded-lg border-theme-strong">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <UsernameBadge
                      userId={supporterGroup.fromUserId}
                      username={supporterGroup.fromUsername}
                      variant="link"
                      size="sm"
                      showBadge={true}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{supporterGroup.totalTokens} tokens</span>
                    <span>•</span>
                    <span>{supporterGroup.pageCount} page{supporterGroup.pageCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(supporterGroup.totalUsdValue)}</div>
                </div>
              </div>
            ))
          )}
          {allocations.length > 5 && (
            <div className="text-center text-sm text-muted-foreground py-2">
              +{allocations.length - 5} more allocations
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
