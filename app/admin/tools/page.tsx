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