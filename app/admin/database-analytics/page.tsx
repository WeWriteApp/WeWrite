'use client';

/**
 * Database Read Analytics Admin Page
 * 
 * Dedicated admin page for monitoring database read patterns, cost projections,
 * and optimization effectiveness during the 2.5M reads/60min crisis.
 */

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { ChevronLeft, Shield, Database } from 'lucide-react';
import { DatabaseReadAnalyticsDashboard } from '../../components/admin/DatabaseReadAnalyticsDashboard';
import { isAdmin } from '../../utils/isAdmin';

export default function DatabaseAnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    router.push('/login');
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Check admin permissions
  if (!isAdmin(user.email)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You don't have permission to access this page.
          </p>
          <Link 
            href="/" 
            className="text-primary hover:text-primary/80 underline"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl py-6 px-4">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/admin" 
            className="inline-flex items-center text-primary hover:text-primary/80 mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Database className="h-8 w-8 text-destructive" />
              <h1 className="text-3xl font-bold">Database Read Analytics</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-destructive rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-destructive">EMERGENCY MONITORING</span>
            </div>
          </div>
          
          <p className="text-muted-foreground">
            Real-time monitoring and optimization tracking for the 2.5M reads/60min crisis
          </p>
          
          {/* Crisis Alert Banner */}
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-5 w-5 text-destructive" />
              <span className="font-semibold text-destructive">Database Read Crisis Active</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Current read volume: <strong>2.5M reads/60min</strong> with spikes up to <strong>300K reads/min</strong>. 
              Multiple optimization systems have been deployed to reduce database load by 70-90%.
            </p>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="space-y-6">
          <DatabaseReadAnalyticsDashboard />
          
          {/* Additional Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-card border rounded-lg">
              <h3 className="font-semibold mb-2">Optimization Systems Deployed</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ Aggressive Financial Data Caching (30min TTL)</li>
                <li>✅ Global Allocation State Management</li>
                <li>✅ Enhanced Emergency Circuit Breaker</li>
                <li>✅ Request Deduplication Middleware</li>
                <li>✅ Intelligent Cache Warming</li>
                <li>✅ Optimized Notification System</li>
              </ul>
            </div>
            
            <div className="p-4 bg-card border rounded-lg">
              <h3 className="font-semibold mb-2">Expected Impact</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>📉 72% total read reduction</li>
                <li>💰 $650/month cost savings</li>
                <li>⚡ 95% cache hit rate target</li>
                <li>🛡️ Circuit breaker protection</li>
                <li>🚀 Maintained user experience</li>
                <li>📊 Real-time monitoring</li>
              </ul>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="p-4 bg-muted/50 border rounded-lg">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Link 
                href="/admin/dashboard"
                className="inline-flex items-center px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                View Full Dashboard
              </Link>
              <Link 
                href="/admin"
                className="inline-flex items-center px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
              >
                Admin Tools
              </Link>
              <button 
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-3 py-2 text-sm bg-outline border rounded-md hover:bg-muted"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
