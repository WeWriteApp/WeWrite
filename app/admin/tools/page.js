"use client";

import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Loader, AlertCircle, CheckCircle2, RefreshCw, Bell, Flame } from 'lucide-react';
import { calculatePastStreaks } from '../../scripts/calculatePastStreaks';
import { backfillNotifications } from '../../scripts/backfillNotifications';
import { useRouter } from 'next/navigation';

export default function AdminToolsPage() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('streaks');
  
  // State for streak calculation
  const [streakCalculationRunning, setStreakCalculationRunning] = useState(false);
  const [streakCalculationResult, setStreakCalculationResult] = useState(null);
  
  // State for notification backfill
  const [notificationBackfillRunning, setNotificationBackfillRunning] = useState(false);
  const [notificationBackfillResult, setNotificationBackfillResult] = useState(null);
  
  // Check if user is admin
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/tools');
    } else if (user) {
      // Check if user is admin
      const checkAdmin = async () => {
        try {
          // This is a simple check - in a real app, you'd want to check against a database
          // or use Firebase Auth custom claims
          const adminEmails = ['admin@wewrite.com', 'jamie@wewrite.com'];
          setIsAdmin(adminEmails.includes(user.email));
          
          if (!adminEmails.includes(user.email)) {
            router.push('/');
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          router.push('/');
        }
      };
      
      checkAdmin();
    }
  }, [user, authLoading, router]);
  
  // Handle streak calculation
  const handleCalculateStreaks = async () => {
    try {
      setStreakCalculationRunning(true);
      setStreakCalculationResult(null);
      
      const result = await calculatePastStreaks();
      setStreakCalculationResult(result);
    } catch (error) {
      console.error('Error calculating streaks:', error);
      setStreakCalculationResult({
        success: false,
        error: error.message
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
    } catch (error) {
      console.error('Error backfilling notifications:', error);
      setNotificationBackfillResult({
        success: false,
        error: error.message
      });
    } finally {
      setNotificationBackfillRunning(false);
    }
  };
  
  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin h-8 w-8 text-primary"/>
      </div>
    );
  }
  
  // Show nothing if not authenticated or not admin
  if (!user || !isAdmin) {
    return null;
  }
  
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Admin Tools</h1>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="streaks">
            <Flame className="h-4 w-4 mr-2" />
            Streak Calculation
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notification Backfill
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
      </Tabs>
    </div>
  );
}
