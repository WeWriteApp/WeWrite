"use client";

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  AlertTriangle, 
  X, 
  RefreshCw,
  TestTube,
  DollarSign,
  UserX
} from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../providers/AuthProvider';
import { TestModeDetectionService, TestModeStatus } from '../../services/testModeDetectionService';
import { isAdmin } from '../../utils/feature-flags';

/**
 * Test Mode Alert Bar Component
 *
 * Displays a prominent warning banner when any test modes are active.
 * This component helps prevent confusion between test data and real financial data
 * by providing clear visual indicators and exit options.
 *
 * FEATURES:
 * - Automatic detection of active test modes
 * - Prominent visual styling (orange background)
 * - Detailed test mode information display
 * - Quick exit/reset functionality
 * - Admin-only visibility
 *
 * POSITIONING:
 * - Appears at the top of the page when test modes are active
 * - Fixed positioning to ensure visibility
 * - Responsive design for mobile devices
 *
 * SECURITY:
 * - Only visible to admin users
 * - Provides safe exit mechanisms
 * - Prevents accidental test data confusion
 */
export default function TestModeAlertBar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [testStatus, setTestStatus] = useState<TestModeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check if user is admin
  const userIsAdmin = isAdmin(user?.email);

  /**
   * Load test mode status for current user
   * Only runs for admin users to detect active test modes
   */
  const loadTestStatus = async () => {
    if (!user?.uid || !userIsAdmin) return;

    try {
      setLoading(true);
      const status = await TestModeDetectionService.detectTestModeStatus(user.uid);
      setTestStatus(status);
    } catch (error) {
      console.error('[TestModeAlertBar] Error loading test status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Exit all test modes
  const handleExitTestMode = async () => {
    if (!user?.uid) return;
    
    try {
      setExiting(true);
      const result = await TestModeDetectionService.exitAllTestModes(user.uid);
      
      if (result.success) {
        toast({
          title: "Test Mode Exited",
          description: result.message,
        });
        
        // Reload test status
        await loadTestStatus();
        
        // Refresh the page to ensure all UI updates
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[TestModeAlertBar] Error exiting test mode:', error);
      toast({
        title: "Error",
        description: "Failed to exit test mode",
        variant: "destructive"
      });
    } finally {
      setExiting(false);
    }
  };

  // Load status on mount and when user changes
  useEffect(() => {
    loadTestStatus();
  }, [user?.uid, userIsAdmin]);

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    if (!userIsAdmin) return;
    
    const interval = setInterval(loadTestStatus, 30000);
    return () => clearInterval(interval);
  }, [userIsAdmin]);

  // Don't show if not admin, no test status, not in test mode, or dismissed
  if (!userIsAdmin || !testStatus || !testStatus.isTestModeActive || dismissed) {
    return null;
  }

  const getTestModeIcon = () => {
    if (testStatus.activeTests.mockEarnings && testStatus.activeTests.inactiveSubscription) {
      return <TestTube className="h-4 w-4" />;
    } else if (testStatus.activeTests.mockEarnings) {
      return <DollarSign className="h-4 w-4" />;
    } else if (testStatus.activeTests.inactiveSubscription) {
      return <UserX className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getTestModeDescription = () => {
    const activeTests = [];
    
    if (testStatus.activeTests.mockEarnings) {
      const { mockTokensAmount, mockUsdAmount, mockEarningsCount } = testStatus.details;
      activeTests.push(
        `Mock Earnings (${mockEarningsCount} allocation${mockEarningsCount !== 1 ? 's' : ''}, ${mockTokensAmount} tokens, $${mockUsdAmount?.toFixed(2)})`
      );
    }
    
    if (testStatus.activeTests.inactiveSubscription) {
      activeTests.push('Inactive Subscription Test');
    }

    return `Admin Test Mode Active: ${activeTests.join(', ')}`;
  };

  return (
    <div className="w-full bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-800">
      <Alert className="rounded-none border-0 bg-transparent">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            {getTestModeIcon()}
            <div className="flex items-center gap-2">
              <AlertDescription className="text-orange-800 dark:text-orange-200 font-medium">
                {getTestModeDescription()}
              </AlertDescription>
              
              <div className="flex gap-1">
                {testStatus.activeTests.mockEarnings && (
                  <Badge variant="outline" className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                    Mock Earnings
                  </Badge>
                )}
                {testStatus.activeTests.inactiveSubscription && (
                  <Badge variant="outline" className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                    Inactive Sub Test
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={loadTestStatus}
              disabled={loading}
              variant="ghost"
              size="sm"
              className="text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
            <Button
              onClick={handleExitTestMode}
              disabled={exiting}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {exiting ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  Exiting...
                </>
              ) : (
                'Exit Test Mode'
              )}
            </Button>
            
            <Button
              onClick={() => setDismissed(true)}
              variant="ghost"
              size="sm"
              className="text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}
