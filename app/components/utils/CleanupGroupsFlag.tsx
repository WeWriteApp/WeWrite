"use client";

import React from 'react';
import { Button } from "../ui/button";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from "../../firebase/config";
import { useToast } from "../ui/use-toast";
import { Trash2 } from 'lucide-react';

/**
 * Temporary component to clean up the groups feature flag from the database
 * This should be used once to remove any remaining groups flag that might be
 * causing the toast notification issue.
 */
export default function CleanupGroupsFlag() {
  const { toast } = useToast();
  const [isCleaningUp, setIsCleaningUp] = React.useState(false);

  const cleanupGroupsFlag = async () => {
    try {
      setIsCleaningUp(true);
      console.log('[CleanupGroupsFlag] Starting cleanup...');

      // Get feature flags from Firestore
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      const featureFlagsDoc = await getDoc(featureFlagsRef);

      if (featureFlagsDoc.exists()) {
        const flagsData = featureFlagsDoc.data();
        console.log('[CleanupGroupsFlag] Current flags:', flagsData);

        // Check if groups flag exists
        if ('groups' in flagsData) {
          console.log('[CleanupGroupsFlag] Found groups flag, removing...');
          
          // Create new object without groups flag
          const cleanedFlags = { ...flagsData };
          delete cleanedFlags.groups;

          // Update the database
          await setDoc(featureFlagsRef, cleanedFlags);
          
          console.log('[CleanupGroupsFlag] Groups flag removed successfully');
          toast({
            title: 'Success',
            description: 'Groups feature flag has been removed from the database',
            variant: 'default'
          });
        } else {
          console.log('[CleanupGroupsFlag] No groups flag found');
          toast({
            title: 'Info',
            description: 'No groups feature flag found in the database',
            variant: 'default'
          });
        }
      } else {
        console.log('[CleanupGroupsFlag] No feature flags document found');
        toast({
          title: 'Info',
          description: 'No feature flags document found',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('[CleanupGroupsFlag] Error:', error);
      toast({
        title: 'Error',
        description: `Failed to cleanup groups flag: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="destructive"
        size="sm"
        className="gap-2 w-full"
        onClick={cleanupGroupsFlag}
        disabled={isCleaningUp}
      >
        {isCleaningUp ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        {isCleaningUp ? 'Cleaning up...' : 'Remove Groups Flag'}
      </Button>
      
      <p className="text-xs text-muted-foreground">
        This will remove any remaining groups feature flag from the database
        to stop the toast notification issue.
      </p>
    </div>
  );
}
