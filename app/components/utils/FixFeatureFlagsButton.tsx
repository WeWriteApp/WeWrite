"use client";

import React from 'react';
import { Button } from "../ui/button";
// Removed direct Firebase imports - now using API endpoints
import { FeatureFlag } from "../../utils/feature-flags";
import { useToast } from "../ui/use-toast";
import { RefreshCw } from 'lucide-react';

// Define valid feature flags
const validFeatureFlags: FeatureFlag[] = [
  'payments',
  'map_view',
  'calendar_view',
  'inactive_subscription'
];

export default function FixFeatureFlagsButton() {
  const { toast } = useToast();
  const [isFixing, setIsFixing] = React.useState(false);

  const fixFeatureFlags = async () => {
    try {
      setIsFixing(true);
      console.log('[DEBUG] Starting feature flag fix...');

      // Call the API endpoint to sync feature flags (which will fix them)
      const response = await fetch('/api/feature-flags', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fix feature flags');
      }

      if (!result.success) {
        throw new Error(result.error || 'Fix operation failed');
      }

      console.log('[DEBUG] SUCCESS: Feature flags have been fixed successfully');
      console.log('[DEBUG] Updated feature flags:', result.data.flags);

      toast({
        title: 'Success',
        description: result.data.message || 'Feature flags have been fixed successfully',
        variant: 'default'
      });
          } else {
            console.log('[DEBUG] ERROR: Feature flags were not fixed correctly');
            toast({
              title: 'Error',
              description: 'Feature flags were not fixed correctly',
              variant: 'destructive'
            });
          }
        }
      } else {
        console.log('[DEBUG] No feature flags document found in database, creating it');

        // Create a new document with all valid flags disabled
        const initialFlags: Record<string, boolean> = {};
        validFeatureFlags.forEach(flag => {
          initialFlags[flag] = false;
        });

        await setDoc(featureFlagsRef, initialFlags);

        // Verify the creation
        const createdDoc = await getDoc(featureFlagsRef);
        if (createdDoc.exists()) {
          toast({
            title: 'Success',
            description: 'Feature flags have been created successfully',
            variant: 'default'
          });
        }
      }
    } catch (error) {
      console.error('Error fixing feature flags:', error);
      toast({
        title: 'Error',
        description: `Failed to fix feature flags: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 w-full"
      onClick={fixFeatureFlags}
      disabled={isFixing}
    >
      <RefreshCw className={`h-4 w-4 ${isFixing ? 'animate-spin' : ''}`} />
      {isFixing ? 'Fixing Feature Flags...' : 'Fix Feature Flags'}
    </Button>
  );
}