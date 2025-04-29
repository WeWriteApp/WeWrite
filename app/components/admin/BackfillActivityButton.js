"use client";

import { useState } from 'react';
import { Button } from '../ui/button';
import { backfillActivityCalendar } from '../../scripts/backfillActivityCalendar';
import { Loader } from '../Loader';

/**
 * BackfillActivityButton component
 * 
 * Admin component to trigger the activity calendar backfill process
 * 
 * @param {Object} props
 * @param {string} props.userId - Optional user ID to process only one user
 */
export default function BackfillActivityButton({ userId = null }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleBackfill = async () => {
    try {
      setIsProcessing(true);
      setResult(null);
      setError(null);

      // Confirm before processing all users
      if (!userId) {
        const confirmed = window.confirm(
          'This will process activity data for ALL users and may take a long time. Continue?'
        );
        if (!confirmed) {
          setIsProcessing(false);
          return;
        }
      }

      // Run the backfill process
      const backfillResult = await backfillActivityCalendar(userId);
      
      if (backfillResult.success) {
        setResult(`Successfully processed ${backfillResult.usersProcessed} users`);
      } else {
        setError(backfillResult.error || 'Unknown error occurred');
      }
    } catch (err) {
      console.error('Error during backfill:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <Button 
          onClick={handleBackfill} 
          disabled={isProcessing}
          variant="outline"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              {userId ? 'Processing User Activity...' : 'Processing All Users...'}
            </>
          ) : (
            <>
              {userId ? 'Backfill Activity for This User' : 'Backfill Activity for All Users'}
            </>
          )}
        </Button>
        
        {result && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
            {result}
          </div>
        )}
        
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md text-sm">
            Error: {error}
          </div>
        )}
      </div>
      
      <div className="text-xs text-muted-foreground">
        <p>This process will analyze page versions to calculate user activity data for the activity calendar.</p>
        {!userId && (
          <p className="mt-1">Warning: Processing all users may take a significant amount of time.</p>
        )}
      </div>
    </div>
  );
}
