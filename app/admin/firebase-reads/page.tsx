"use client";

import React from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { FirebaseReadMonitor } from '../../components/admin/FirebaseReadMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function FirebaseReadsAdminPage() {
  const { user } = useAuth();

  // Simple admin check - in a real app, you'd want proper role-based access control
  const isAdmin = user?.email && (
    user.email.includes('admin') ||
    user.email.includes('jamiegray') ||
    user.email === 'contact@jamiegray.net'
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              Please log in to access the Firebase Read Monitor.
            </p>
            <Link 
              href="/login" 
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Log In
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              You don't have permission to access this admin panel.
            </p>
            <Link 
              href="/" 
              className="inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/"
              className="inline-flex items-center text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to App
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Admin Panel
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Firebase Read Optimization Dashboard
              </p>
            </div>
          </div>
        </div>

        {/* Admin Notice */}
        <Card className="mb-6 border-theme-medium bg-primary/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Admin Access Granted
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  You have access to Firebase read optimization monitoring and analytics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Firebase Read Monitor */}
        <FirebaseReadMonitor />

        {/* Additional Admin Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>About This Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
              <p>
                This dashboard monitors Firebase Firestore read operations to help optimize costs and performance. 
                The optimization system includes:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Intelligent caching with configurable TTL</li>
                <li>Throttled real-time listeners</li>
                <li>Batched operations for multiple reads</li>
                <li>Field-selective queries</li>
                <li>Automatic cache cleanup and management</li>
              </ul>
              <p>
                <strong>Target Metrics:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Cache Hit Rate: &gt;80%</li>
                <li>Average Query Time: &lt;100ms</li>
                <li>Error Rate: &lt;1%</li>
                <li>Daily Read Reduction: &gt;60%</li>
              </ul>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                For detailed documentation, see <code>docs/FIREBASE_READ_OPTIMIZATION.md</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}