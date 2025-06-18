"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Loader, DollarSign, Users, RefreshCw } from 'lucide-react';
import { useContributorCount } from '../../hooks/useContributorCount';
import { getUserContributorCount, updateUserContributorCount } from '../../firebase/counters';
import { contributorsService } from '../../services/ContributorsService';

/**
 * Test component for Contributors Count feature
 * This component allows testing the contributor count functionality
 */
export default function ContributorCountTest() {
  const [testUserId, setTestUserId] = useState('');
  const [manualCount, setManualCount] = useState<number | null>(null);
  const [isLoadingManual, setIsLoadingManual] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Test the real-time hook
  const { 
    count: realtimeCount, 
    isLoading: isLoadingRealtime, 
    error,
    refresh 
  } = useContributorCount(testUserId || null, true);

  const handleManualFetch = async () => {
    if (!testUserId) return;
    
    setIsLoadingManual(true);
    try {
      const count = await getUserContributorCount(testUserId);
      setManualCount(count);
    } catch (err) {
      console.error('Error fetching manual count:', err);
      setManualCount(null);
    } finally {
      setIsLoadingManual(false);
    }
  };

  const handleUpdateCount = async () => {
    if (!testUserId) return;
    
    setIsUpdating(true);
    try {
      await updateUserContributorCount(testUserId);
      // Refresh both counts
      refresh();
      await handleManualFetch();
    } catch (err) {
      console.error('Error updating count:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTestService = async () => {
    if (!testUserId) return;
    
    try {
      const stats = await contributorsService.getContributorStats(testUserId);
      console.log('Contributor stats:', stats);
      alert(`Contributors: ${stats.count}\nUnique IDs: ${stats.uniqueContributors.join(', ')}`);
    } catch (err) {
      console.error('Error testing service:', err);
      alert('Error testing service - check console');
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <DollarSign className="h-6 w-6" />
        Contributors Count Test
      </h2>

      <div className="space-y-6">
        {/* User ID Input */}
        <div>
          <label htmlFor="userId" className="block text-sm font-medium mb-2">
            Test User ID
          </label>
          <input
            id="userId"
            type="text"
            value={testUserId}
            onChange={(e) => setTestUserId(e.target.value)}
            placeholder="Enter user ID to test..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Test Results */}
        {testUserId && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Real-time Count */}
            <Card className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Real-time Count
              </h3>
              <div className="text-center">
                {isLoadingRealtime ? (
                  <Loader className="h-6 w-6 animate-spin mx-auto" />
                ) : error ? (
                  <div className="text-red-500 text-sm">{error}</div>
                ) : (
                  <div className="text-2xl font-bold">{realtimeCount}</div>
                )}
              </div>
              <Button 
                onClick={refresh} 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                disabled={isLoadingRealtime}
              >
                Refresh
              </Button>
            </Card>

            {/* Manual Count */}
            <Card className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Manual Count
              </h3>
              <div className="text-center">
                {isLoadingManual ? (
                  <Loader className="h-6 w-6 animate-spin mx-auto" />
                ) : (
                  <div className="text-2xl font-bold">
                    {manualCount !== null ? manualCount : '-'}
                  </div>
                )}
              </div>
              <Button 
                onClick={handleManualFetch} 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                disabled={isLoadingManual}
              >
                Fetch Manual
              </Button>
            </Card>
          </div>
        )}

        {/* Action Buttons */}
        {testUserId && (
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleUpdateCount}
              disabled={isUpdating}
              className="flex-1"
            >
              {isUpdating ? (
                <Loader className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Update Count
            </Button>
            
            <Button 
              onClick={handleTestService}
              variant="outline"
              className="flex-1"
            >
              Test Service
            </Button>
          </div>
        )}

        {/* Instructions */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20">
          <h4 className="font-semibold mb-2">Testing Instructions:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Enter a user ID that has pages with pledges</li>
            <li>Check that real-time and manual counts match</li>
            <li>Create/modify pledges and verify real-time updates</li>
            <li>Test the service to see detailed contributor data</li>
            <li>Use "Update Count" to force recalculation</li>
          </ol>
        </Card>
      </div>
    </Card>
  );
}
