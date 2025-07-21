'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Activity } from 'lucide-react';

interface VerificationResult {
  status: 'success' | 'error';
  data?: any;
  error?: string;
  endpoint: string;
}

interface DashboardVerificationData {
  verification: {
    results: Record<string, VerificationResult>;
    health: { total: number; passed: number; failed: number };
  };
  analytics: {
    results: Record<string, VerificationResult>;
    health: { total: number; passed: number; failed: number };
  };
  overall: {
    status: 'healthy' | 'warning' | 'critical';
    health: { verificationScore: number; analyticsScore: number; overallScore: number };
    recommendations: string[];
  };
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
  };
  timestamp: string;
}

export function DashboardVerificationWidget() {
  const [data, setData] = useState<DashboardVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runVerification = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/verify-dashboard');
      
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to run verification');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runVerification();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'error':
      case 'critical':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="wewrite-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Dashboard Health Check</h3>
        </div>
        
        <button
          onClick={runVerification}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running...' : 'Run Check'}
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="loader"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Verification Failed</span>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <div className="space-y-4">
          {/* Overall Status */}
          <div className={`p-4 rounded-md ${getStatusColor(data.overall.status)}`}>
            <div className="flex items-center gap-2 mb-2">
              {getStatusIcon(data.overall.status)}
              <span className="font-medium">
                Overall Status: {data.overall.status.charAt(0).toUpperCase() + data.overall.status.slice(1)}
              </span>
            </div>
            <div className="text-sm">
              {data.summary.passedTests}/{data.summary.totalTests} tests passed 
              ({Math.round(data.overall.health.overallScore)}% health score)
            </div>
          </div>

          {/* Data Pipeline Verification */}
          <div>
            <h4 className="font-medium mb-2">Data Pipeline Verification</h4>
            <div className="space-y-2">
              {Object.entries(data.verification.results).map(([name, result]) => (
                <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{name}</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="text-xs text-gray-500">
                      {result.status === 'success' ? 'OK' : result.error}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Analytics API Verification */}
          <div>
            <h4 className="font-medium mb-2">Analytics API Verification</h4>
            <div className="space-y-2">
              {Object.entries(data.analytics.results).map(([name, result]) => (
                <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{name}</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="text-xs text-gray-500">
                      {result.status === 'success' ? 'OK' : result.error}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {data.overall.recommendations.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {data.overall.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-gray-500 pt-2 border-t">
            Last checked: {new Date(data.timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
