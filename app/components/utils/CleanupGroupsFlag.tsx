"use client";

import React from 'react';
import { Button } from "../ui/button";
// Removed direct Firebase imports - now using API endpoints
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

      // Call the API endpoint to sync feature flags (which will remove invalid flags like 'groups')
      const response = await fetch('/api/feature-flags', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cleanup groups flag');
      }

      if (!result.success) {
        throw new Error(result.error || 'Cleanup operation failed');
      }

      console.log('[CleanupGroupsFlag] Cleanup completed successfully');
      console.log('[CleanupGroupsFlag] Updated flags:', result.data.flags);

      toast({
        title: 'Success',
        description: result.data.message || 'Groups feature flag has been cleaned up successfully',
        variant: 'default'
      });
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