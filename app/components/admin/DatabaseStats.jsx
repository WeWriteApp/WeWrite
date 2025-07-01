/**
 * Component to display database usage statistics for admin users
 * This helps monitor and optimize database costs
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { getQueryStats, clearQueryStats } from '@/utils/queryMonitor';
import { db } from '../../../firebase/config';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export default function DatabaseStats() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [queryStats, setQueryStats] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch database statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        // Get statistics from Firestore
        const statsDoc = await getDocs(query(
          collection(db, 'statistics'),
          orderBy('timestamp', 'desc'),
          limit(1)
        ));

        if (!statsDoc.empty) {
          setStats(statsDoc.docs[0].data());
        }

        // Get query performance stats
        setQueryStats(getQueryStats());

        setLoading(false);
      } catch (error) {
        console.error('Error fetching database stats:', error);
        setLoading(false);
      }
    };

    fetchStats();

    // Set up interval to refresh stats
    const interval = setInterval(() => {
      setQueryStats(getQueryStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Handle clearing query stats
  const handleClearStats = () => {
    clearQueryStats();
    setQueryStats([]);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Database Usage Statistics</CardTitle>
        <CardDescription>
          Monitor and optimize database usage to reduce costs
        </CardDescription>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mx-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="queries">Query Performance</TabsTrigger>
          <TabsTrigger value="optimization">Optimization Tips</TabsTrigger>
        </TabsList>

        <CardContent>
          <TabsContent value="overview" className="space-y-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard
                  title="Total Users"
                  value={stats.userCount || 0}
                  description="Registered users in the system"
                />
                <StatCard
                  title="Total Pages"
                  value={stats.pageCount || 0}
                  description="Pages created by all users"
                />
                <StatCard
                  title="Public Pages"
                  value={stats.publicPageCount || 0}
                  description="Publicly accessible pages"
                />
                <StatCard
                  title="Avg Pages Per User"
                  value={isNaN(stats.avgPagesPerUser) ? '0.00' : (stats.avgPagesPerUser || 0).toFixed(2)}
                  description="Average number of pages per user"
                />
                <StatCard
                  title="Last Updated"
                  value={stats.timestamp ? new Date(stats.timestamp.seconds * 1000).toLocaleString() : 'Unknown'}
                  description="When these statistics were last updated"
                  className="md:col-span-2"
                />
              </div>
            ) : (
              <div className="text-center py-4">
                No statistics available
              </div>
            )}
          </TabsContent>

          <TabsContent value="queries" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Recent Query Performance</h3>
              <Button variant="outline" size="sm" onClick={handleClearStats}>
                Clear Stats
              </Button>
            </div>

            {queryStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Query Name</th>
                      <th className="text-left py-2 px-4">Duration (ms)</th>
                      <th className="text-left py-2 px-4">Timestamp</th>
                      <th className="text-left py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queryStats.map((stat, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4">{stat.name}</td>
                        <td className="py-2 px-4">{isNaN(stat.duration) ? '0.00' : stat.duration.toFixed(2)}</td>
                        <td className="py-2 px-4">{new Date(stat.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2 px-4">
                          {stat.error ? (
                            <span className="text-red-500">Error</span>
                          ) : (
                            <span className="text-green-500">Success</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4">
                No query statistics available
              </div>
            )}
          </TabsContent>

          <TabsContent value="optimization" className="space-y-4">
            <div className="prose max-w-none dark:prose-invert">
              <h3>Database Optimization Tips</h3>
              <ul>
                <li>
                  <strong>Use field selection</strong> - Only fetch the fields you need using <code>.select()</code>
                </li>
                <li>
                  <strong>Implement pagination</strong> - Use cursor-based pagination with <code>startAfter()</code> and <code>limit()</code>
                </li>
                <li>
                  <strong>Batch operations</strong> - Use batch writes for multiple operations
                </li>
                <li>
                  <strong>Client-side caching</strong> - Cache frequently accessed data with TTL
                </li>
                <li>
                  <strong>Optimize listeners</strong> - Limit the scope of real-time listeners
                </li>
                <li>
                  <strong>Create composite indexes</strong> - For queries with multiple filters or sorting
                </li>
                <li>
                  <strong>Denormalize data</strong> - For frequently accessed relationships
                </li>
              </ul>

              <h3>Current Optimizations</h3>
              <ul>
                <li>Pagination for user pages (200 items per page)</li>
                <li>Caching for frequently accessed pages</li>
                <li>Batch operations for group page fetching</li>
                <li>Query performance monitoring</li>
                <li>Scheduled cleanup for temporary data</li>
              </ul>
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>

      <CardFooter className="text-sm text-muted-foreground">
        Last refreshed: {new Date().toLocaleTimeString()}
      </CardFooter>
    </Card>
  );
}

// Helper component for stats cards
function StatCard({ title, value, description, className = '' }) {
  return (
    <div className={`bg-muted/50 p-4 rounded-lg ${className}`}>
      <h3 className="font-medium text-lg">{title}</h3>
      <p className="text-2xl font-bold my-2">{value}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}