"use client";

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Loader, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { useUserDonorStats } from '../../hooks/useUserDonorStats';
import { UserDonorAnalyticsService } from '../../services/userDonorAnalytics';
import UserDonorKPI from '../analytics/UserDonorKPI';
import { useFeatureFlag } from '../../utils/feature-flags';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';

/**
 * Test component for UserDonorKPI feature
 * This component allows testing the donor analytics functionality
 */
export default function UserDonorKPITest() {
  const [testUserId, setTestUserId] = useState('');
  const [manualStats, setManualStats] = useState<any>(null);
  const [isLoadingManual, setIsLoadingManual] = useState(false);
  const { currentAccount } = useCurrentAccount();
  
  // Test feature flag
  const paymentsEnabled = useFeatureFlag('payments', currentAccount?.email, currentAccount?.uid);
  
  // Test the real-time hook
  const { 
    donorStats, 
    isLoading: isLoadingRealtime, 
    error,
    refetch 
  } = useUserDonorStats(testUserId || '');

  const handleManualFetch = async () => {
    if (!testUserId) return;
    
    setIsLoadingManual(true);
    try {
      const stats = await UserDonorAnalyticsService.getUserDonorAnalytics(testUserId);
      setManualStats(stats);
      console.log('Manual donor stats:', stats);
    } catch (err) {
      console.error('Error fetching manual stats:', err);
      setManualStats(null);
    } finally {
      setIsLoadingManual(false);
    }
  };

  const handleTestAPI = async () => {
    if (!testUserId) return;
    
    try {
      const response = await fetch(`/api/users/${testUserId}/donors`);
      const result = await response.json();
      console.log('API response:', result);
      alert(`API Test Result:\nSuccess: ${result.success}\nCurrent Month Donors: ${result.data?.currentMonthDonors || 0}\nTotal Tokens: ${result.data?.totalActiveTokens || 0}`);
    } catch (err) {
      console.error('Error testing API:', err);
      alert('Error testing API - check console');
    }
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Users className="h-6 w-6" />
        User Donor KPI Test
      </h2>

      <div className="space-y-6">
        {/* Feature Flag Status */}
        <Card className={`p-4 ${paymentsEnabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <h3 className="font-semibold mb-2">Feature Flag Status</h3>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${paymentsEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>Payments Feature: {paymentsEnabled ? 'ENABLED' : 'DISABLED'}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            User: {currentAccount?.email || 'Not logged in'}
          </div>
        </Card>

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

        {/* Live Component Test */}
        {testUserId && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Live UserDonorKPI Component</h3>
            <div className="border-2 border-dashed border-gray-300 p-4 rounded-lg">
              <UserDonorKPI userId={testUserId} />
            </div>
          </Card>
        )}

        {/* Test Results */}
        {testUserId && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hook Results */}
            <Card className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Hook Results
              </h3>
              <div className="space-y-2">
                {isLoadingRealtime ? (
                  <Loader className="h-6 w-6 animate-spin mx-auto" />
                ) : error ? (
                  <div className="text-red-500 text-sm">{error}</div>
                ) : donorStats ? (
                  <div className="text-sm space-y-1">
                    <div>Current Month: <strong>{donorStats.currentMonthDonors}</strong></div>
                    <div>Total Tokens: <strong>{donorStats.totalActiveTokens}</strong></div>
                    <div>Sparkline Data: <strong>[{donorStats.sparklineData.join(', ')}]</strong></div>
                  </div>
                ) : (
                  <div className="text-gray-500">No data</div>
                )}
              </div>
              <Button 
                onClick={refetch} 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                disabled={isLoadingRealtime}
              >
                Refresh Hook
              </Button>
            </Card>

            {/* Manual Service Results */}
            <Card className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Manual Service
              </h3>
              <div className="space-y-2">
                {isLoadingManual ? (
                  <Loader className="h-6 w-6 animate-spin mx-auto" />
                ) : manualStats ? (
                  <div className="text-sm space-y-1">
                    <div>Current Month: <strong>{manualStats.currentMonthDonors}</strong></div>
                    <div>Total Tokens: <strong>{manualStats.totalActiveTokens}</strong></div>
                    <div>Monthly Data: <strong>{manualStats.monthlyData.length} months</strong></div>
                  </div>
                ) : (
                  <div className="text-gray-500">No data</div>
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
              onClick={handleTestAPI}
              variant="outline"
              className="flex-1"
            >
              Test API Endpoint
            </Button>
            
            <Button 
              onClick={() => console.log('Current state:', { donorStats, manualStats, paymentsEnabled })}
              variant="outline"
              className="flex-1"
            >
              Log State
            </Button>
          </div>
        )}

        {/* Instructions */}
        <Card className="p-4 bg-blue-50 dark:bg-blue-900/20">
          <h4 className="font-semibold mb-2">Testing Instructions:</h4>
          <ol className="text-sm space-y-1 list-decimal list-inside">
            <li>Verify payments feature flag is enabled (green status above)</li>
            <li>Enter a user ID that should have token allocations</li>
            <li>Check if the live component renders properly</li>
            <li>Compare hook results vs manual service results</li>
            <li>Test the API endpoint to verify server-side functionality</li>
            <li>Check browser console for any errors or debug logs</li>
          </ol>
        </Card>
      </div>
    </Card>
  );
}
