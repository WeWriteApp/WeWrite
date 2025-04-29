'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function BackfillPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  const runBackfill = async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/backfill/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // No body means it will process the current user
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.message);
        // After 2 seconds, refresh the page to show updated data
        setTimeout(() => {
          router.refresh();
        }, 2000);
      } else {
        setError(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err.message || 'Failed to run backfill');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Fix Your Activity Calendar</h1>

      <div className="mb-6">
        <p className="mb-2">
          This tool will analyze your page edits and update your activity calendar data.
        </p>
        <p className="text-neutral-500 dark:text-neutral-400 mb-4">
          This will fix any discrepancies between your actual activity and what's shown in the calendar.
        </p>

        <Button
          onClick={runBackfill}
          disabled={isRunning}
          className="w-full md:w-auto"
        >
          {isRunning ? 'Updating Calendar...' : 'Update My Activity Calendar'}
        </Button>
      </div>

      {result && (
        <div className="p-4 bg-green-100 dark:bg-green-900 rounded-md mb-4">
          <p className="text-green-800 dark:text-green-200">✅ {result}</p>
          <p className="text-green-700 dark:text-green-300 mt-2">Refreshing page to show updated data...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900 rounded-md mb-4">
          <p className="text-red-800 dark:text-red-200">❌ Error: {error}</p>
        </div>
      )}

      <div className="mt-8">
        <Button
          variant="outline"
          onClick={() => router.push('/')}
          className="w-full md:w-auto"
        >
          Return to Home
        </Button>
      </div>
    </div>
  );
}
