/**
 * Simplified Database Statistics Component
 * Displays basic database statistics for admin users
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { RefreshCw, Database, Users, FileText, Eye, Trash2 } from 'lucide-react';

export default function DatabaseStats() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  // Fetch database statistics from API
  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/database-stats');

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch database statistics');
      }

      setStats(result.data.stats);
    } catch (err) {
      console.error('Error fetching database stats:', err);
      setError(err.message || 'Failed to load database statistics');
    } finally {
      setLoading(false);
    }
  };

  // Refresh statistics
  const refreshStats = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch('/api/admin/database-stats', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh stats: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to refresh database statistics');
      }

      setStats(result.data.stats);
    } catch (err) {
      console.error('Error refreshing database stats:', err);
      setError(err.message || 'Failed to refresh database statistics');
    } finally {
      setRefreshing(false);
    }
  };

  // Load stats on component mount
  useEffect(() => {
    fetchStats();

    // 🚨 EMERGENCY: Disable auto-refresh to stop 13K reads/min crisis
    // const interval = setInterval(() => {
    //   setQueryStats(getQueryStats());
    // }, 5000);
    // return () => clearInterval(interval);
    console.warn('🚨 EMERGENCY: DatabaseStats auto-refresh disabled to stop database read crisis');
  }, []);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Statistics
          </CardTitle>
          <CardDescription>Loading database statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Statistics
          </CardTitle>
          <CardDescription className="text-red-600">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchStats} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Database Statistics
        </CardTitle>
        <CardDescription>
          Basic database usage overview
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Statistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              icon={<Users className="h-5 w-5" />}
              title="Total Users"
              value={stats?.totalUsers || 0}
              description="Registered users"
            />
            <StatCard
              icon={<FileText className="h-5 w-5" />}
              title="Total Pages"
              value={stats?.totalPages || 0}
              description="All pages created"
            />
            <StatCard
              icon={<Eye className="h-5 w-5" />}
              title="Public Pages"
              value={stats?.totalPublicPages || 0}
              description="Publicly visible pages"
            />
            <StatCard
              icon={<Trash2 className="h-5 w-5" />}
              title="Deleted Pages"
              value={stats?.totalDeletedPages || 0}
              description="Soft-deleted pages"
            />
            <StatCard
              icon={<RefreshCw className="h-5 w-5" />}
              title="Recent Activity"
              value={stats?.recentActivity || 0}
              description="Pages modified (7 days)"
            />
            <div className="flex items-center justify-center">
              <Button
                onClick={refreshStats}
                disabled={refreshing}
                variant="outline"
                className="w-full"
              >
                {refreshing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh Stats
              </Button>
            </div>
          </div>

          {/* Last Updated */}
          {stats?.lastUpdated && (
            <div className="text-sm text-gray-500 text-center pt-4 border-t">
              Last updated: {new Date(stats.lastUpdated).toLocaleString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Simplified StatCard component
function StatCard({ icon, title, value, description }) {
  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      <div className="text-2xl font-bold mb-1">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-600">{description}</div>
    </div>
  );

