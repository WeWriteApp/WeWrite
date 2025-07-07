"use client";

import React from 'react';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { RefreshCw, CheckCircle } from 'lucide-react';

export default function SyncFeatureFlagsButton() {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [lastSyncTime, setLastSyncTime] = React.useState<string | null>(null);

  const syncFeatureFlags = async () => {
    try {
      setIsSyncing(true);
      console.log('[SyncFeatureFlags] Starting feature flag synchronization...');

      // Call the API endpoint to sync feature flags
      const response = await fetch('/api/feature-flags', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync feature flags');
      }

      if (!result.success) {
        throw new Error(result.error || 'Sync operation failed');
      }

      console.log('[SyncFeatureFlags] Successfully synced feature flags:', result.data.flags);
      setLastSyncTime(new Date().toLocaleString());

      toast({
        title: 'Success',
        description: result.data.message || 'Feature flags have been synchronized successfully',
        variant: 'default'
      });

    } catch (error) {
      console.error('[SyncFeatureFlags] Error syncing feature flags:', error);

      let errorMessage = 'Failed to sync feature flags';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Handle specific error cases
      if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        errorMessage = 'Admin access required to sync feature flags';
      } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = 'Please log in to sync feature flags';
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 w-full"
        onClick={syncFeatureFlags}
        disabled={isSyncing}
      >
        {isSyncing ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
        {isSyncing ? 'Syncing Feature Flags...' : 'Sync Feature Flags'}
      </Button>

      {lastSyncTime && (
        <p className="text-xs text-muted-foreground text-center">
          Last synced: {lastSyncTime}
        </p>
      )}
    </div>
  );
}