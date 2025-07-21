"use client";

import React, { useState, useEffect } from 'react';
import { Clock, Eye, Edit, Users, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '../ui/dropdown-menu';
import ActivityCard from '../activity/ActivityCard';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';

interface RecentEdit {
  id: string;
  title: string;
  userId: string;
  username: string;
  displayName?: string;
  lastModified: string;
  isPublic: boolean;
  totalPledged?: number;
  pledgeCount?: number;
  lastDiff?: {
    hasChanges: boolean;
    preview?: string;
    addedChars?: number;
    removedChars?: number;
  };
}

interface Filters {
  includeOwn: boolean;
  followingOnly: boolean;
}

export default function SimpleRecentEdits() {
  const { currentAccount } = useCurrentAccount();
  const [edits, setEdits] = useState<RecentEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    includeOwn: false, // Hide own edits by default
    followingOnly: false
  });

  const fetchRecentEdits = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: '20',
        includeOwn: filters.includeOwn.toString(),
        followingOnly: filters.followingOnly.toString()
      });

      if (currentAccount?.uid) {
        params.set('userId', currentAccount.uid);
      }

      const response = await fetch(`/api/recent-edits?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch recent edits: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setEdits(data.edits || []);
    } catch (err) {
      console.error('Error fetching recent edits:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch recent edits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentEdits();
  }, [currentAccount?.uid, filters]);

  // Auto-refresh every 2 minutes to ensure recent edits stay fresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchRecentEdits();
      }
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(interval);
  }, [loading]);

  const updateFilter = (key: keyof Filters, value: boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Edits</h2>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Edits</h2>
        </div>
        <div className="border border-destructive/20 rounded-lg p-4 text-center text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Recent Edits</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRecentEdits}
            disabled={loading}
            className="h-8 w-8 p-0"
            title="Refresh recent edits"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 px-3 rounded-2xl">
                <Eye className="h-4 w-4" />
                <span className="sr-only">Filter</span>
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => updateFilter('followingOnly', false)}
              >
                <Eye className="h-4 w-4 mr-2" />
                All Recent Edits
              </DropdownMenuItem>
              
              <DropdownMenuItem
                onClick={() => updateFilter('followingOnly', true)}
              >
                <Users className="h-4 w-4 mr-2" />
                Following Only
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuCheckboxItem
                checked={!filters.includeOwn}
                onCheckedChange={(checked) => updateFilter('includeOwn', !checked)}
              >
                Hide my own edits
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      {edits.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No recent edits found</p>
          <p className="text-sm">
            {filters.followingOnly 
              ? "Try following some pages to see their edits here"
              : "Recent page edits will appear here"
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {edits.map((edit) => {
            const activityCardData = {
              pageId: edit.id,
              pageName: edit.title,
              userId: edit.userId,
              username: edit.username,
              displayName: edit.displayName,
              timestamp: edit.lastModified,
              lastModified: edit.lastModified,
              diff: edit.lastDiff,
              diffPreview: edit.lastDiff?.preview,
              isNewPage: !edit.lastDiff?.hasChanges,
              isPublic: edit.isPublic,
              totalPledged: edit.totalPledged,
              pledgeCount: edit.pledgeCount,
              activityType: 'page_edit' as const
            };

            return (
              <ActivityCard
                key={edit.id}
                activity={activityCardData}
                isCarousel={false}
                compactLayout={false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
