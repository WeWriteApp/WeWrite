"use client";

import React, { useState, useEffect } from 'react';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Loader, AlertCircle, CheckCircle2, RefreshCw, Bell, Flame, Calendar, DollarSign, ChevronLeft, Settings, Eye } from 'lucide-react';
import { calculatePastStreaks } from '../../scripts/calculatePastStreaks';

// Temporary stub functions for missing scripts
const backfillNotifications = async () => {
  console.warn('backfillNotifications not implemented yet');
  return { success: false, error: 'Function not implemented' };
};

const backfillActivityCalendar = async () => {
  console.warn('backfillActivityCalendar not implemented yet');
  return { success: false, error: 'Function not implemented' };
};
import { useRouter } from 'next/navigation';
import { useConfirmation } from '../../hooks/useConfirmation';
import ConfirmationModal from '../../components/utils/ConfirmationModal';
import FeeManagementSection from '../../components/admin/FeeManagementSection';
import ComprehensiveFeeManagement from '../../components/admin/ComprehensiveFeeManagement';

export default function AdminToolsPage() {
  const { session, isAuthenticated } = useCurrentAccount();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('streaks');

  // Custom modal hooks
  const { confirmationState, confirm, closeConfirmation } = useConfirmation();

  // State for streak calculation
  const [streakCalculationRunning, setStreakCalculationRunning] = useState(false);
  const [streakCalculationResult, setStreakCalculationResult] = useState<any>(null);

  // State for notification backfill
  const [notificationBackfillRunning, setNotificationBackfillRunning] = useState(false);
  const [notificationBackfillResult, setNotificationBackfillResult] = useState<any>(null);

  // State for activity calendar backfill
  const [activityBackfillRunning, setActivityBackfillRunning] = useState(false);
  const [activityBackfillResult, setActivityBackfillResult] = useState<any>(null);

  // State for state simulator
  const [simulatorVisible, setSimulatorVisible] = useState(true);

  // Check simulator visibility on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHidden = sessionStorage.getItem('admin-state-simulator-hidden') === 'true';
      setSimulatorVisible(!isHidden);
    }
  }, []);

  // Function to show the simulator
  const showSimulator = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin-state-simulator-hidden');
      setSimulatorVisible(true);
      // Refresh the page to re-mount the simulator
      window.location.reload();
    }
  };

  // Function to get current simulator state
  const getCurrentSimulatorState = () => {
    if (typeof window === 'undefined') return null;

    try {
      const savedState = localStorage.getItem('admin-state-simulator');
      return savedState ? JSON.parse(savedState) : null;
    } catch {
      return null;
    }
  };

  const currentSimulatorState = getCurrentSimulatorState();

  // Function to reset simulator state
  const resetSimulatorState = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin-state-simulator');
      sessionStorage.removeItem('admin-state-simulator-hidden');
      setSimulatorVisible(true);
      window.location.reload();
    }
  };

  // Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login?redirect=/admin/tools');
    } else if (session) {
      // Check if user is admin
      const checkAdmin = async () => {
        try {
          // Only jamiegray2234@gmail.com has admin access
          const adminEmails = ['jamiegray2234@gmail.com'];
          setIsAdmin(adminEmails.includes(session.email));

          if (!adminEmails.includes(session.email)) {
            router.push('/');
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          router.push('/');
        }
      };

      checkAdmin();
    }
  }, [, session, isAuthenticated, router]);

  // Handle streak calculation
  const handleCalculateStreaks = async () => {
    try {
      setStreakCalculationRunning(true);
      setStreakCalculationResult(null);

      const result = await calculatePastStreaks();
      setStreakCalculationResult(result);
    } catch (error: unknown) {
      console.error('Error calculating streaks:', error);
      setStreakCalculationResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setStreakCalculationRunning(false);
    }
  };

  // Handle notification backfill
  const handleBackfillNotifications = async () => {
    try {
      setNotificationBackfillRunning(true);
      setNotificationBackfillResult(null);

      const result = await backfillNotifications();
      setNotificationBackfillResult(result);
    } catch (error: unknown) {
      console.error('Error backfilling notifications:', error);
      setNotificationBackfillResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setNotificationBackfillRunning(false);
    }
  };

  // Handle activity calendar backfill
  const handleActivityBackfill = async () => {
    try {
      setActivityBackfillRunning(true);
      setActivityBackfillResult(null);

      // Confirm before running
      const confirmed = await confirm({
        title: 'Backfill Activity Calendar',
        message: 'This will backfill activity calendar data for all users. This operation may take a long time. Continue?',
        confirmText: 'Continue',
        cancelText: 'Cancel',
        variant: 'warning',
        icon: 'warning'
      });

      if (!confirmed) {
        setActivityBackfillRunning(false);
        return;
      }

      const result = await backfillActivityCalendar();
      setActivityBackfillResult(result);
    } catch (error: unknown) {
      console.error('Error backfilling activity calendar:', error);
      setActivityBackfillResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setActivityBackfillRunning(false);
    }
  };

  // Show loading state while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin h-8 w-8 text-primary"/>
      </div>
    );
  }

  // Show nothing if not authenticated or not admin
  if (!session || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Tools</h1>

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="streaks">
            <Flame className="h-4 w-4 mr-2" />
            Streak Calculation
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notification Backfill
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Calendar className="h-4 w-4 mr-2" />
            Activity Calendar
          </TabsTrigger>
          <TabsTrigger value="fees">
            <DollarSign className="h-4 w-4 mr-2" />
            Fee Management
          </TabsTrigger>
          <TabsTrigger value="simulator">
            <Settings className="h-4 w-4 mr-2" />
            State Simulator
          </TabsTrigger>
        </TabsList>

        {/* Streak Calculation Tab */}
        <TabsContent value="streaks">
          <Card>
            <CardHeader>
              <CardTitle>Calculate User Streaks</CardTitle>
              <CardDescription>
                This tool will analyze past user activity and calculate writing streaks.
                It will update the streak data for all users based on their page edit history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {streakCalculationResult && (
                <Alert className={`mb-4 ${streakCalculationResult.success ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                  {streakCalculationResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <AlertTitle>
                    {streakCalculationResult.success ? 'Success!' : 'Error'}
                  </AlertTitle>
                  <AlertDescription>
                    {streakCalculationResult.success
                      ? `Successfully processed ${streakCalculationResult.usersProcessed} users.`
                      : `Error: ${streakCalculationResult.error}`
                    }
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-muted-foreground mb-4">
                This process may take several minutes to complete depending on the size of your database.
                The page will remain responsive, but please do not navigate away until the process completes.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleCalculateStreaks}
                disabled={streakCalculationRunning}
                className="w-full"
              >
                {streakCalculationRunning ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Calculating Streaks...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Calculate Streaks
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Notification Backfill Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Backfill Notifications</CardTitle>
              <CardDescription>
                This tool will create notifications for past follows and page links.
                It will analyze existing data and create missing notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {notificationBackfillResult && (
                <Alert className={`mb-4 ${notificationBackfillResult.success ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                  {notificationBackfillResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <AlertTitle>
                    {notificationBackfillResult.success ? 'Success!' : 'Error'}
                  </AlertTitle>
                  <AlertDescription>
                    {notificationBackfillResult.success
                      ? (
                        <div>
                          <p>Successfully backfilled notifications:</p>
                          <ul className="list-disc list-inside mt-2">
                            <li>{notificationBackfillResult.stats.followNotificationsCreated} follow notifications</li>
                            <li>{notificationBackfillResult.stats.linkNotificationsCreated} link notifications</li>
                            <li>Processed {notificationBackfillResult.stats.pagesProcessed} pages</li>
                            {notificationBackfillResult.stats.errors > 0 && (
                              <li className="text-amber-500">{notificationBackfillResult.stats.errors} errors encountered (see console)</li>
                            )}
                          </ul>
                        </div>
                      )
                      : `Error: ${notificationBackfillResult.error}`
                    }
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-muted-foreground mb-4">
                This process may take several minutes to complete depending on the size of your database.
                The page will remain responsive, but please do not navigate away until the process completes.
              </p>

              <div className="bg-amber-500/10 p-4 rounded-md mb-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-amber-700 dark:text-amber-400">Important Note</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Backfilled notifications will be marked as "read" to avoid overwhelming users with
                      notifications for past events. Only new follows and links will create unread notifications.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleBackfillNotifications}
                disabled={notificationBackfillRunning}
                className="w-full"
              >
                {notificationBackfillRunning ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Backfilling Notifications...
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Backfill Notifications
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Activity Calendar Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Backfill Activity Calendar</CardTitle>
              <CardDescription>
                This tool will analyze page versions to create activity calendar data for all users.
                It will update both the activity calendar data and streak information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityBackfillResult && (
                <Alert className={`mb-4 ${activityBackfillResult.success ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  {activityBackfillResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <AlertTitle>
                    {activityBackfillResult.success ? 'Success!' : 'Error'}
                  </AlertTitle>
                  <AlertDescription>
                    {activityBackfillResult.success
                      ? `Successfully processed ${activityBackfillResult.usersProcessed} users.`
                      : `Error: ${activityBackfillResult.error}`
                    }
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-sm text-muted-foreground mb-4">
                This process will analyze all page versions to calculate user activity data for the activity calendar.
                It may take several minutes to complete depending on the size of your database.
              </p>

              <div className="bg-blue-500/10 p-4 rounded-md mb-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-blue-700 dark:text-blue-400">What This Does</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      This tool will:
                      <ul className="list-disc list-inside mt-2">
                        <li>Analyze all page versions to find user activity dates</li>
                        <li>Create activity calendar data for each user</li>
                        <li>Update streak information based on activity dates</li>
                        <li>Store the data in the userActivityCalendar collection</li>
                      </ul>
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleActivityBackfill}
                disabled={activityBackfillRunning}
                className="w-full"
              >
                {activityBackfillRunning ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Backfilling Activity Calendar...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-4 w-4" />
                    Backfill Activity Calendar
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          <ComprehensiveFeeManagement />
        </TabsContent>

        {/* State Simulator Tab */}
        <TabsContent value="simulator">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-5 w-5" />
                Admin State Simulator
              </CardTitle>
              <CardDescription>
                Control the floating admin state simulator for testing different app states
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Settings className="h-5 w-5 text-orange-500" />
                  <div>
                    <h3 className="font-medium">State Simulator</h3>
                    <p className="text-sm text-muted-foreground">
                      Floating UI for simulating auth, subscription, and token states
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {simulatorVisible ? 'Visible' : 'Hidden'}
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={showSimulator}
                      disabled={simulatorVisible}
                      className="flex items-center space-x-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span>{simulatorVisible ? 'Already Visible' : 'Show Simulator'}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetSimulatorState}
                      className="flex items-center space-x-1"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Reset State</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Current State Display */}
              {currentSimulatorState && (
                <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                  <h4 className="font-medium mb-3">Current Simulator State</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Auth:</span>
                      <span className="ml-2 text-muted-foreground">
                        {currentSimulatorState.authState === 'logged-out' ? 'Logged Out' : 'Logged In'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Subscription:</span>
                      <span className="ml-2 text-muted-foreground">
                        {currentSimulatorState.subscriptionState === 'none' ? 'None' :
                         currentSimulatorState.subscriptionState === 'active' ? 'Active' :
                         currentSimulatorState.subscriptionState === 'cancelling' ? 'Cancelling' :
                         currentSimulatorState.subscriptionState === 'payment-failed' ? 'Payment Failed' :
                         currentSimulatorState.subscriptionState}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Spending:</span>
                      <span className="ml-2 text-muted-foreground">
                        {currentSimulatorState.spendingState?.pastMonthTokensSent ? 'Tokens Sent' : 'No Tokens Sent'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Earnings:</span>
                      <span className="ml-2 text-muted-foreground">
                        {currentSimulatorState.tokenEarningsState?.none ? 'None' : 'Has Earnings'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      Position: ({Math.round(currentSimulatorState.position?.x || 0)}, {Math.round(currentSimulatorState.position?.y || 0)})
                    </span>
                  </div>
                </div>
              )}

              <Alert>
                <Settings className="h-4 w-4" />
                <AlertTitle>How to Use</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>The Admin State Simulator is a floating UI element that allows you to:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Toggle between logged in/logged out states</li>
                    <li>Simulate different subscription states (none, active, cancelling, payment failed)</li>
                    <li>Test spending states (past month tokens sent)</li>
                    <li>Simulate various token earning states (unfunded, pending, locked)</li>
                  </ul>
                  <p className="mt-3">
                    <strong>Controls:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Hover/Touch:</strong> Expand the collapsed simulator</li>
                    <li><strong>Drag:</strong> Move the simulator around the screen</li>
                    <li><strong>Hide for Session:</strong> Hide until page refresh (use button above to restore)</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Integration Guide</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Components can use simulated state by importing the appropriate hooks:
                </p>
                <div className="bg-white dark:bg-gray-900 p-3 rounded border text-xs font-mono">
                  <div className="text-gray-600 dark:text-gray-400">// For auth state simulation</div>
                  <div>import {`{ useSimulatedAuth }`} from '../hooks/useSimulatedAuth';</div>
                  <br />
                  <div className="text-gray-600 dark:text-gray-400">// For all simulated states</div>
                  <div>import {`{ useSimulatedAppState }`} from '../providers/AdminStateSimulatorProvider';</div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">Extensibility</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  To add new state categories, edit <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">app/config/adminStateSimulatorConfig.ts</code>
                  and follow the documentation in <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">docs/admin-state-simulator.md</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Custom Modals */}
      <ConfirmationModal
        isOpen={confirmationState.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationState.onConfirm}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        variant={confirmationState.variant}
        icon={confirmationState.icon}
        isLoading={confirmationState.isLoading}
      />
      </div>
    </div>
  );
}