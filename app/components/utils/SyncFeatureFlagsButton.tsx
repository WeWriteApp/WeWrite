"use client";

import React from 'react';
import { Button } from '../ui/button';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useToast } from '../ui/use-toast';
import { RefreshCw, CheckCircle } from 'lucide-react';

// Define the complete set of feature flags that should exist
const COMPLETE_FEATURE_FLAGS = {
  payments: false,
  map_view: false,
  calendar_view: false,
  inactive_subscription: false
};

export default function SyncFeatureFlagsButton() {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [lastSyncTime, setLastSyncTime] = React.useState<string | null>(null);

  const syncFeatureFlags = async () => {
    try {
      setIsSyncing(true);
      console.log('[SyncFeatureFlags] Starting feature flag synchronization...');

      // Get current feature flags from Firestore
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      let currentFlags = {};
      if (featureFlagsDoc.exists()) {
        currentFlags = featureFlagsDoc.data();
        console.log('[SyncFeatureFlags] Current flags in database:', currentFlags);
      } else {
        console.log('[SyncFeatureFlags] No feature flags document found, will create new one');
      }

      // Merge current flags with complete set, preserving existing values
      const mergedFlags = { ...COMPLETE_FEATURE_FLAGS };

      // Preserve existing flag values if they exist
      Object.keys(currentFlags).forEach(flag => {
        if (flag in COMPLETE_FEATURE_FLAGS) {
          mergedFlags[flag] = currentFlags[flag];
          console.log(`[SyncFeatureFlags] Preserving existing value for ${flag}: ${currentFlags[flag]}`);
        } else {
          console.log(`[SyncFeatureFlags] Removing invalid flag: ${flag}`);
        }
      });

      // Add any missing flags with default values
      Object.keys(COMPLETE_FEATURE_FLAGS).forEach(flag => {
        if (!(flag in currentFlags)) {
          console.log(`[SyncFeatureFlags] Adding missing flag ${flag} with default value: ${COMPLETE_FEATURE_FLAGS[flag]}`);
        }
      });

      // Update the database
      await setDoc(featureFlagsRef, mergedFlags);
      console.log('[SyncFeatureFlags] Successfully updated feature flags:', mergedFlags);

      // Update feature metadata
      const featureMetaRef = doc(db, 'config', 'featureMetadata');
      const timestamp = new Date().toISOString();

      const metadata = {
        subscription_management: {
          createdAt: timestamp,
          lastModified: timestamp,
          description: 'Enable subscription functionality and UI for managing user subscriptions.'
        },
        map_view: {
          createdAt: timestamp,
          lastModified: timestamp,
          description: 'Enable map view for pages with location data and geographic visualization.'
        },
        calendar_view: {
          createdAt: timestamp,
          lastModified: timestamp,
          description: 'Enable calendar view for activity tracking and temporal organization.'
        },
        // groups feature removed
        notifications: {
          createdAt: timestamp,
          lastModified: timestamp,
          description: 'Enable in-app notifications for follows, page links, and other activities.'
        },
        link_functionality: {
          createdAt: timestamp,
          lastModified: timestamp,
          description: 'Enable link creation and editing in page editors. When disabled, shows a modal with social media follow prompt.'
        }
      };

      await setDoc(featureMetaRef, metadata);
      console.log('[SyncFeatureFlags] Successfully updated feature metadata');

      setLastSyncTime(new Date().toLocaleString());

      toast({
        title: 'Success',
        description: 'Feature flags have been synchronized successfully',
        variant: 'default'
      });

    } catch (error) {
      console.error('[SyncFeatureFlags] Error syncing feature flags:', error);
      toast({
        title: 'Error',
        description: `Failed to sync feature flags: ${error.message}`,
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
