"use client";

import React, { useState, useEffect } from 'react';
import { DashboardAnalyticsService } from '../services/dashboardAnalytics';

export default function TestAnalyticsPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalyticsTest = async () => {
    console.log('🧪 [Test Analytics] Starting analytics test...');
    setLoading(true);
    setError(null);
    
    try {
      // Test date range - last 7 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      const dateRange = { startDate, endDate };
      
      console.log('📅 [Test Analytics] Testing with date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      // Test new pages created
      console.log('📊 [Test Analytics] Testing New Pages Created...');
      const newPagesData = await DashboardAnalyticsService.getNewPagesCreated(dateRange);
      console.log('✅ [Test Analytics] New Pages Data:', newPagesData);
      
      // Test edits analytics
      console.log('📊 [Test Analytics] Testing Edits Analytics...');
      const editsData = await DashboardAnalyticsService.getEditsAnalytics(dateRange);
      console.log('✅ [Test Analytics] Edits Data:', editsData);
      
      // Test all metrics
      console.log('📊 [Test Analytics] Testing All Metrics...');
      const allMetrics = await DashboardAnalyticsService.getAllMetrics(dateRange);
      console.log('✅ [Test Analytics] All Metrics:', allMetrics);
      
      const results = {
        success: true,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        newPagesData: {
          length: newPagesData.length,
          totalPages: newPagesData.reduce((sum, item) => sum + item.count, 0),
          sampleData: newPagesData.slice(0, 3)
        },
        editsData: {
          length: editsData.length,
          totalEdits: editsData.reduce((sum, item) => sum + item.count, 0),
          sampleData: editsData.slice(0, 3)
        },
        allMetrics
      };
      
      console.log('🎉 [Test Analytics] Test completed successfully:', results);
      setTestResults(results);
      
    } catch (err) {
      console.error('❌ [Test Analytics] Test failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setTestResults({
        success: false,
        error: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-run test on page load
    runAnalyticsTest();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Analytics Service Test</h1>
        <p className="text-gray-600">
          This page tests the DashboardAnalyticsService to verify it's working correctly.
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={runAnalyticsTest}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded"
        >
          {loading ? 'Running Test...' : 'Run Analytics Test'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h3 className="font-bold">Error:</h3>
          <p>{error}</p>
        </div>
      )}

      {testResults && (
        <div className="space-y-6">
          <div className="p-4 bg-gray-100 rounded">
            <h2 className="text-xl font-bold mb-2">Test Results</h2>
            <div className="mb-2">
              <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                testResults.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
              }`}>
                {testResults.success ? 'SUCCESS' : 'FAILED'}
              </span>
            </div>
            
            {testResults.success && (
              <>
                <div className="mb-4">
                  <h3 className="font-semibold">Date Range:</h3>
                  <p className="text-sm text-gray-600">
                    {testResults.dateRange.startDate} to {testResults.dateRange.endDate}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-white rounded border">
                    <h3 className="font-semibold mb-2">New Pages Data</h3>
                    <p>Total Days: {testResults.newPagesData.length}</p>
                    <p>Total Pages: {testResults.newPagesData.totalPages}</p>
                    <div className="mt-2">
                      <h4 className="text-sm font-medium">Sample Data:</h4>
                      <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(testResults.newPagesData.sampleData, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded border">
                    <h3 className="font-semibold mb-2">Edits Data</h3>
                    <p>Total Days: {testResults.editsData.length}</p>
                    <p>Total Edits: {testResults.editsData.totalEdits}</p>
                    <div className="mt-2">
                      <h4 className="text-sm font-medium">Sample Data:</h4>
                      <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                        {JSON.stringify(testResults.editsData.sampleData, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-white rounded border">
                  <h3 className="font-semibold mb-2">All Metrics</h3>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(testResults.allMetrics, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>

          <div className="p-4 bg-blue-50 rounded">
            <h3 className="font-semibold mb-2">Full Test Results (JSON)</h3>
            <pre className="text-xs bg-white p-3 rounded border overflow-x-auto">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-yellow-50 rounded">
        <h3 className="font-semibold mb-2">Instructions</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>This test runs automatically when the page loads</li>
          <li>Check the browser console for detailed logs</li>
          <li>The test queries the last 7 days of data</li>
          <li>If successful, you should see data for new pages and edits</li>
          <li>If there are no pages/edits in the last 7 days, the counts will be 0</li>
        </ol>
      </div>
    </div>
  );
}
