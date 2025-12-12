'use client';

import React, { useState, useEffect } from 'react';
import { Database, Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface EnvironmentInfo {
  environment: {
    type: string;
    prefix: string;
    isProduction: boolean;
    isPreview: boolean;
    isDevelopment: boolean;
  };
  collections: Record<string, string>;
  expectedBehavior: Record<string, string>;
}

export function AdminDataAccessInfo() {
  const [environmentInfo, setEnvironmentInfo] = useState<EnvironmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnvironmentInfo = async () => {
      try {
        const response = await fetch('/api/admin/debug-environment');
        if (response.ok) {
          const data = await response.json();
          setEnvironmentInfo(data.data);
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to fetch environment info');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    };

    fetchEnvironmentInfo();
  }, []);

  if (loading) {
    return (
      <div className="wewrite-card">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Data Access Information</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="loader"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wewrite-card">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Data Access Information</h3>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Error Loading Environment Info</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!environmentInfo) {
    return null;
  }

  const isAdminAccessingProduction = true; // Admin always accesses production data
  const currentEnvironment = environmentInfo.environment.type;

  return (
    <div className="wewrite-card">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Database className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Admin Data Access</h3>
      </div>

      {/* Admin Data Access Status */}
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-green-600" />
          <span className="font-medium text-green-800">Admin Mode: Production Data Access</span>
        </div>
        <p className="text-green-700 text-sm">
          As an admin, you are viewing <strong>production data</strong> regardless of the current environment.
          This ensures you always see real metrics and user data.
        </p>
      </div>

      {/* Environment Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-gray-50 rounded-md">
          <h4 className="font-medium mb-2">Current Environment</h4>
          <div className="space-y-1 text-sm">
            <div><strong>Type:</strong> {currentEnvironment}</div>
            <div><strong>Regular User Prefix:</strong> "{environmentInfo.environment.prefix}"</div>
            <div><strong>Admin Data Access:</strong> Production (no prefix)</div>
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-md">
          <h4 className="font-medium mb-2">Data Collections</h4>
          <div className="space-y-1 text-sm">
            <div><strong>Analytics:</strong> analytics_events</div>
            <div><strong>Users:</strong> users</div>
            <div><strong>Pages:</strong> pages</div>
            <div><strong>USD Balances:</strong> usdBalances</div>
          </div>
        </div>
      </div>

      {/* Data Access Comparison */}
      <div className="mb-4">
        <h4 className="font-medium mb-2">Data Access Comparison</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">User Type</th>
                <th className="text-left p-2">Environment</th>
                <th className="text-left p-2">Collections Accessed</th>
                <th className="text-left p-2">Data Type</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2">Regular User</td>
                <td className="p-2">{currentEnvironment}</td>
                <td className="p-2 font-mono text-xs">
                  {environmentInfo.environment.prefix ? 
                    `${environmentInfo.environment.prefix}pages, ${environmentInfo.environment.prefix}users` :
                    'pages, users'
                  }
                </td>
                <td className="p-2">
                  {environmentInfo.environment.prefix ? 'Development/Test' : 'Production'}
                </td>
              </tr>
              <tr className="bg-green-50">
                <td className="p-2 font-medium">Admin User (You)</td>
                <td className="p-2">{currentEnvironment}</td>
                <td className="p-2 font-mono text-xs">pages, users, analytics_events</td>
                <td className="p-2 font-medium text-green-700">Production</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Important Notes */}
      <div className="p-3 bg-muted/50 border border-border rounded-md">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground mb-1">Important Notes</h4>
            <ul className="text-primary text-sm space-y-1">
              <li>• Admin dashboards always show production data for accurate metrics</li>
              <li>• Regular users in development see isolated test data (DEV_ prefix)</li>
              <li>• All admin analytics and reports reflect real user activity</li>
              <li>• Changes made through admin tools affect production data</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Environment-Specific Behavior */}
      {environmentInfo.environment.isDevelopment && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800 mb-1">Development Environment</h4>
              <p className="text-yellow-700 text-sm">
                You're in development mode, but as an admin, you're still viewing production data. 
                Regular users in this environment see isolated test data with DEV_ prefixes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
