"use client";

import React from 'react';
import { Button } from "../ui/button";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from "../../firebase/config";
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

      // Get feature flags from Firestore
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      if (featureFlagsDoc.exists()) {
        const flagsData = featureFlagsDoc.data();
        console.log('[DEBUG] Current feature flags in database:', flagsData);

        // Create a new object with only valid flags
        const validFlags: Record<string, boolean> = {};

        // Copy only valid flags
        validFeatureFlags.forEach(flag => {
          if (flag in flagsData) {
            validFlags[flag] = flagsData[flag];
          } else {
            // Initialize missing flags as disabled
            validFlags[flag] = false;
            console.log(`[DEBUG] Adding missing flag '${flag}' as disabled`);
          }
        });

        // Check for invalid flags
        Object.keys(flagsData).forEach(flag => {
          if (!validFeatureFlags.includes(flag as FeatureFlag)) {
            console.log(`[DEBUG] Removing invalid flag '${flag}' from database`);
          }
        });

        // Update the database with only valid flags
        await setDoc(featureFlagsRef, validFlags);
        console.log('[DEBUG] Updated feature flags in database:', validFlags);

        // Verify the update
        const updatedDoc = await getDoc(featureFlagsRef);
        if (updatedDoc.exists()) {
          const updatedData = updatedDoc.data();
          console.log('[DEBUG] Verified feature flags in database:', updatedData);

          // Check if all valid flags are present
          const allFlagsPresent = validFeatureFlags.every(flag => flag in updatedData);
          console.log(`[DEBUG] All valid flags present: ${allFlagsPresent}`);

          // Check if any invalid flags are present
          const invalidFlagsPresent = Object.keys(updatedData).some(flag => !validFeatureFlags.includes(flag as FeatureFlag));
          console.log(`[DEBUG] Invalid flags present: ${invalidFlagsPresent}`);

          if (allFlagsPresent && !invalidFlagsPresent) {
            console.log('[DEBUG] SUCCESS: Feature flags have been fixed successfully');
            toast({
              title: 'Success',
              description: 'Feature flags have been fixed successfully',
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
