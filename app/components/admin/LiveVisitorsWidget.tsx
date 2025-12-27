"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { visitorTrackingService } from '../../services/VisitorTrackingService';

interface LiveVisitorsWidgetProps {
  className?: string;
}

interface VisitorCounts {
  total: number;
  authenticated: number;
  anonymous: number;
  bots: number;
  legitimateVisitors: number;
}

export function LiveVisitorsWidget({ className = "" }: LiveVisitorsWidgetProps) {
  const [counts, setCounts] = useState<VisitorCounts>({
    total: 0,
    authenticated: 0,
    anonymous: 0,
    bots: 0,
    legitimateVisitors: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupSubscription = () => {
      try {
        unsubscribe = visitorTrackingService.subscribeToVisitorCount((newCounts) => {
          setCounts(newCounts);
          setLastUpdated(new Date());
          setLoading(false);
          setError(null);
        });

        // Clean up stale visitors periodically
        const cleanupInterval = setInterval(() => {
          visitorTrackingService.cleanupStaleVisitors();
        }, 5 * 60 * 1000); // Every 5 minutes

        return () => {
          clearInterval(cleanupInterval);
        };
      } catch (err) {
        console.error('Error setting up visitor count subscription:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect to visitor tracking');
        setLoading(false);
      }
    };

    const cleanup = setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (cleanup) {
        cleanup();
      }
      visitorTrackingService.unsubscribeFromVisitorCount();
    };
  }, []);

  // Format last updated time
  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
      return `${Math.floor(diffSeconds / 60)}m ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  if (error) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="Users" size={20} className="text-destructive" />
          <h3 className="text-lg font-semibold">Live Visitors</h3>
        </div>
        <div className="h-32 flex items-center justify-center text-destructive">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className={`wewrite-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="Eye" size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Live Visitors</h3>

        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-muted-foreground">LIVE</span>
        </div>
      </div>

      {/* Main Count */}
      <div className="text-center mb-6">
        {loading ? (
          <div className="flex items-center justify-center">
            <Icon name="Loader" size={24} />
          </div>
        ) : (
          <>
            <div className="text-4xl font-bold text-primary mb-2">{counts.total}</div>
            <div className="text-sm text-muted-foreground">
              {counts.total === 1 ? 'visitor' : 'visitors'} online now
            </div>
          </>
        )}
      </div>

      {/* Breakdown */}
      {!loading && (
        <div className="space-y-3">
          {/* Authenticated Users */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Icon name="UserCheck" size={16} className="text-green-600" />
              <span className="text-sm font-medium">Authenticated</span>
            </div>
            <span className="text-sm font-bold text-green-600">{counts.authenticated}</span>
          </div>

          {/* Anonymous Users */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Icon name="UserX" size={16} className="text-primary" />
              <span className="text-sm font-medium">Anonymous</span>
            </div>
            <span className="text-sm font-bold text-primary">{counts.anonymous}</span>
          </div>

          {/* Bot Detection Info (Debug Mode) */}
          {debugMode && (
            <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-theme-medium">
              <div className="flex items-center gap-2">
                <Icon name="Users" size={16} className="text-orange-600" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Bots Filtered</span>
              </div>
              <span className="text-sm font-bold text-orange-600">{counts.bots}</span>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {!loading && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
            <span>Bot filtering: Active</span>
          </div>
          {process.env.NODE_ENV === 'development' && debugMode && (() => {
            console.log('[LiveVisitorsWidget] Debug Info:', {
              legitimateVisitors: counts.legitimateVisitors,
              bots: counts.bots,
              refreshInterval: '15s',
              sessionTimeout: '30m'
            });
            return null;
          })()}
        </div>
      )}
    </div>
  );
}