'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

interface TestResult {
  name: string;
  status: 'success' | 'error' | 'loading';
  message: string;
  data?: any;
}

export function AdminDashboardTest() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [environmentInfo, setEnvironmentInfo] = useState<any>(null);

  const runTests = async () => {
    setIsRunning(true);
    setTests([]);

    const testResults: TestResult[] = [];

    // Test 1: Environment Debug
    try {
      testResults.push({ name: 'Environment Debug', status: 'loading', message: 'Checking environment configuration...' });
      setTests([...testResults]);

      const envResponse = await fetch('/api/admin/debug-environment');
      if (envResponse.ok) {
        const envData = await envResponse.json();
        setEnvironmentInfo(envData.data);
        testResults[testResults.length - 1] = {
          name: 'Environment Debug',
          status: 'success',
          message: `Environment: ${envData.data.environment.type}, Prefix: "${envData.data.environment.prefix}"`,
          data: envData.data
        };
      } else {
        const errorData = await envResponse.json();
        testResults[testResults.length - 1] = {
          name: 'Environment Debug',
          status: 'error',
          message: errorData.error || 'Failed to get environment info'
        };
      }
    } catch (error) {
      testResults[testResults.length - 1] = {
        name: 'Environment Debug',
        status: 'error',
        message: error instanceof Error ? error.message : 'Network error'
      };
    }

    setTests([...testResults]);

    // Test 2: USD Data Verification
    try {
      testResults.push({ name: 'USD Data Pipeline', status: 'loading', message: 'Verifying USD allocation data...' });
      setTests([...testResults]);

      const usdResponse = await fetch('/api/admin/verify-usd-data');
      if (usdResponse.ok) {
        const usdData = await usdResponse.json();
        testResults[testResults.length - 1] = {
          name: 'USD Data Pipeline',
          status: 'success',
          message: `Found ${usdData.data.usdBalances.count} USD balances, ${usdData.data.usdAllocations.count} allocations`,
          data: usdData.data
        };
      } else {
        const errorData = await usdResponse.json();
        testResults[testResults.length - 1] = {
          name: 'USD Data Pipeline',
          status: 'error',
          message: errorData.error || 'Failed to verify USD data'
        };
      }
    } catch (error) {
      testResults[testResults.length - 1] = {
        name: 'USD Data Pipeline',
        status: 'error',
        message: error instanceof Error ? error.message : 'Network error'
      };
    }

    setTests([...testResults]);

    // Test 3: Hourly Aggregations
    try {
      testResults.push({ name: 'Hourly Aggregations', status: 'loading', message: 'Checking hourly analytics data...' });
      setTests([...testResults]);

      const hourlyResponse = await fetch('/api/admin/verify-hourly-aggregations');
      if (hourlyResponse.ok) {
        const hourlyData = await hourlyResponse.json();
        testResults[testResults.length - 1] = {
          name: 'Hourly Aggregations',
          status: 'success',
          message: `Found ${hourlyData.data.hourlyAggregations.count} hourly records, ${hourlyData.data.dailyAggregations.count} daily records`,
          data: hourlyData.data
        };
      } else {
        const errorData = await hourlyResponse.json();
        testResults[testResults.length - 1] = {
          name: 'Hourly Aggregations',
          status: 'error',
          message: errorData.error || 'Failed to verify hourly aggregations'
        };
      }
    } catch (error) {
      testResults[testResults.length - 1] = {
        name: 'Hourly Aggregations',
        status: 'error',
        message: error instanceof Error ? error.message : 'Network error'
      };
    }

    setTests([...testResults]);

    // Test 4: Global Counters
    try {
      testResults.push({ name: 'Global Counters', status: 'loading', message: 'Checking global application counters...' });
      setTests([...testResults]);

      const countersResponse = await fetch('/api/admin/verify-global-counters');
      if (countersResponse.ok) {
        const countersData = await countersResponse.json();
        testResults[testResults.length - 1] = {
          name: 'Global Counters',
          status: 'success',
          message: `Global counters: ${countersData.data.globalCounters.available ? 'Available' : 'Missing'}`,
          data: countersData.data
        };
      } else {
        const errorData = await countersResponse.json();
        testResults[testResults.length - 1] = {
          name: 'Global Counters',
          status: 'error',
          message: errorData.error || 'Failed to verify global counters'
        };
      }
    } catch (error) {
      testResults[testResults.length - 1] = {
        name: 'Global Counters',
        status: 'error',
        message: error instanceof Error ? error.message : 'Network error'
      };
    }

    setTests([...testResults]);
    setIsRunning(false);
  };

  useEffect(() => {
    runTests();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Icon name="CheckCircle" size={20} className="text-green-500" />;
      case 'error':
        return <Icon name="XCircle" size={20} className="text-red-500" />;
      case 'loading':
        return <Icon name="RefreshCw" size={20} className="text-primary animate-spin" />;
      default:
        return <Icon name="Activity" size={20} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'loading':
        return 'text-primary bg-muted/50 border-border';
      default:
        return 'text-muted-foreground bg-muted border-border';
    }
  };

  return (
    <div className="wewrite-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="Database" size={20} className="text-primary" />
          <h3 className="text-lg font-semibold">Admin Dashboard Test</h3>
        </div>
        
        <button
          onClick={runTests}
          disabled={isRunning}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <Icon name="RefreshCw" size={16} className={`${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Testing...' : 'Run Tests'}
        </button>
      </div>

      {/* Environment Info */}
      {environmentInfo && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <h4 className="font-medium mb-2">Environment Configuration</h4>
          <div className="text-sm space-y-1">
            <div><strong>Type:</strong> {environmentInfo.environment.type}</div>
            <div><strong>Prefix:</strong> "{environmentInfo.environment.prefix}"</div>
            <div><strong>Example Collection:</strong> {environmentInfo.collections.analytics_events}</div>
          </div>
        </div>
      )}

      {/* Test Results */}
      <div className="space-y-3">
        {tests.map((test, index) => (
          <div key={index} className={`p-3 rounded-md border ${getStatusColor(test.status)}`}>
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon(test.status)}
              <span className="font-medium">{test.name}</span>
            </div>
            <div className="text-sm">{test.message}</div>
            {test.data && test.status === 'success' && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer">View Details</summary>
                <pre className="text-xs mt-1 p-2 bg-white rounded overflow-auto max-h-32">
                  {JSON.stringify(test.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {tests.length === 0 && !isRunning && (
        <div className="text-center py-8 text-gray-500">
          Click "Run Tests" to verify admin dashboard functionality
        </div>
      )}
    </div>
  );
}
