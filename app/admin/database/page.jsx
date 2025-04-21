'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/app/utils/currentUser';
import DatabaseStats from '@/app/components/admin/DatabaseStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getQueryStatsSummary } from '@/app/utils/queryMonitor';

export default function DatabaseAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  const [querySummary, setQuerySummary] = useState(null);
  
  // Check if user is authorized to access admin page
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
          router.push('/login');
          return;
        }
        
        setUser(currentUser);
        
        // Check if user is an admin (replace with your admin check logic)
        // For now, we'll use a hardcoded list of admin emails
        const adminEmails = [
          'admin@wewrite.com',
          'jamie@wewrite.com',
          // Add other admin emails here
        ];
        
        if (adminEmails.includes(currentUser.email)) {
          setAuthorized(true);
        } else {
          router.push('/');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error checking auth:', error);
        setLoading(false);
        router.push('/');
      }
    };
    
    checkAuth();
  }, [router]);
  
  // Update query summary periodically
  useEffect(() => {
    const updateSummary = () => {
      setQuerySummary(getQueryStatsSummary());
    };
    
    updateSummary();
    const interval = setInterval(updateSummary, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Loading...</h1>
            <p>Checking authorization</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!authorized) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p>You do not have permission to access this page.</p>
            <Button className="mt-4" onClick={() => router.push('/')}>
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Database Administration</h1>
            <p className="text-muted-foreground">
              Monitor and optimize database usage to reduce costs
            </p>
          </div>
          <Button onClick={() => router.push('/admin')}>
            Back to Admin
          </Button>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="stats">Database Stats</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>
          
          <TabsContent value="stats">
            <DatabaseStats />
          </TabsContent>
          
          <TabsContent value="performance">
            <Card>
              <CardHeader>
                <CardTitle>Query Performance Summary</CardTitle>
                <CardDescription>
                  Overview of database query performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {querySummary ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="font-medium">Total Queries</h3>
                      <p className="text-2xl font-bold my-2">{querySummary.totalQueries}</p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="font-medium">Average Duration</h3>
                      <p className="text-2xl font-bold my-2">
                        {querySummary.averageDuration.toFixed(2)} ms
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="font-medium">Error Rate</h3>
                      <p className="text-2xl font-bold my-2">
                        {(querySummary.errorRate * 100).toFixed(2)}%
                      </p>
                    </div>
                    {querySummary.slowestQuery && (
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h3 className="font-medium">Slowest Query</h3>
                        <p className="text-xl font-bold my-2">
                          {querySummary.slowestQuery.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {querySummary.slowestQuery.duration.toFixed(2)} ms
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    No query statistics available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="optimization">
            <Card>
              <CardHeader>
                <CardTitle>Database Optimization</CardTitle>
                <CardDescription>
                  Tools and recommendations for optimizing database usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium mb-2">Scheduled Cleanup</h3>
                    <p className="mb-4">
                      We have implemented scheduled Cloud Functions that run daily to clean up temporary data
                      and optimize database usage.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium">Daily Cleanup</h4>
                        <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                          <li>Removes expired temporary data</li>
                          <li>Computes and stores daily statistics</li>
                          <li>Runs at midnight UTC</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium">Weekly Optimization</h4>
                        <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                          <li>Identifies inefficient data structures</li>
                          <li>Moves large content to subcollections</li>
                          <li>Runs every Sunday at midnight UTC</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium mb-2">Manual Optimization Tools</h3>
                    <p className="mb-4">
                      These tools can be used to manually optimize database usage.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">
                        Clean Temporary Data
                      </Button>
                      <Button variant="outline" size="sm">
                        Compute Statistics
                      </Button>
                      <Button variant="outline" size="sm">
                        Optimize Large Documents
                      </Button>
                      <Button variant="outline" size="sm">
                        Clear Cache
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="text-lg font-medium mb-2">Optimization Recommendations</h3>
                    <ul className="list-disc list-inside space-y-2">
                      <li>
                        <strong>Create composite indexes</strong> for queries with multiple filters
                      </li>
                      <li>
                        <strong>Implement TTL</strong> for all temporary data
                      </li>
                      <li>
                        <strong>Use subcollections</strong> for large documents
                      </li>
                      <li>
                        <strong>Denormalize data</strong> for frequently accessed relationships
                      </li>
                      <li>
                        <strong>Implement cursor-based pagination</strong> for all list views
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
