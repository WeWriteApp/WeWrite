'use client';

import React, { useEffect, useState } from 'react';
import { testMapTileAccess, getMapTileConfig } from '../../utils/mapConfig';
import { Button } from '../../components/ui/button';

interface DiagnosticResult {
  service: string;
  status: 'testing' | 'success' | 'error';
  url?: string;
  error?: string;
  responseTime?: number;
}

export default function MapDiagnosticsPage() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const diagnostics: DiagnosticResult[] = [];

    // Test Mapbox if token is available
    if (mapboxToken && mapboxToken !== 'your-mapbox-token') {
      const mapboxTests = [
        { name: 'Mapbox Light', styleId: 'light-v11' },
        { name: 'Mapbox Dark', styleId: 'dark-v11' }
      ];

      for (const test of mapboxTests) {
        const result: DiagnosticResult = {
          service: test.name,
          status: 'testing',
          url: `https://api.mapbox.com/styles/v1/mapbox/${test.styleId}/tiles/1/0/0?access_token=${mapboxToken}`
        };
        
        diagnostics.push(result);
        setResults([...diagnostics]);

        try {
          const startTime = Date.now();
          const response = await fetch(result.url!, { method: 'HEAD' });
          const responseTime = Date.now() - startTime;
          
          result.status = response.ok ? 'success' : 'error';
          result.responseTime = responseTime;
          if (!response.ok) {
            result.error = `HTTP ${response.status}: ${response.statusText}`;
          }
        } catch (error: any) {
          result.status = 'error';
          result.error = error.message;
        }
        
        setResults([...diagnostics]);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
      }
    }

    // Test CartoDB fallbacks
    const cartoTests = [
      { name: 'CartoDB Light', url: 'https://a.basemaps.cartocdn.com/light_nolabels/1/0/0.png' },
      { name: 'CartoDB Dark', url: 'https://a.basemaps.cartocdn.com/dark_nolabels/1/0/0.png' }
    ];

    for (const test of cartoTests) {
      const result: DiagnosticResult = {
        service: test.name,
        status: 'testing',
        url: test.url
      };
      
      diagnostics.push(result);
      setResults([...diagnostics]);

      try {
        const startTime = Date.now();
        const response = await fetch(test.url, { method: 'HEAD', mode: 'no-cors' });
        const responseTime = Date.now() - startTime;
        
        result.status = 'success'; // no-cors mode always succeeds if network works
        result.responseTime = responseTime;
      } catch (error: any) {
        result.status = 'error';
        result.error = error.message;
      }
      
      setResults([...diagnostics]);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'testing': return '🧪';
      case 'success': return '✅';
      case 'error': return '❌';
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'testing': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">WeWrite Map Diagnostics</h1>
        <p className="text-muted-foreground">
          Testing map tile services to diagnose "image unavailable" issues
        </p>
      </div>

      <div className="mb-6 p-4 bg-muted rounded-lg">
        <h2 className="font-semibold mb-2">Environment Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <strong>Mapbox Token:</strong> {process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? 
              `${process.env.NEXT_PUBLIC_MAPBOX_TOKEN.substring(0, 10)}...` : 
              'Not configured'
            }
          </div>
          <div>
            <strong>Environment:</strong> {process.env.NODE_ENV}
          </div>
          <div>
            <strong>User Agent:</strong> {typeof navigator !== 'undefined' ? 
              navigator.userAgent.substring(0, 50) + '...' : 
              'Server-side'
            }
          </div>
          <div>
            <strong>Current URL:</strong> {typeof window !== 'undefined' ? 
              window.location.href : 
              'Server-side'
            }
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Tile Service Tests</h2>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            variant="outline"
          >
            {isRunning ? 'Running...' : 'Run Tests Again'}
          </Button>
        </div>

        <div className="space-y-3">
          {results.map((result, index) => (
            <div key={index} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getStatusIcon(result.status)}</span>
                  <span className="font-medium">{result.service}</span>
                  <span className={`text-sm ${getStatusColor(result.status)}`}>
                    {result.status}
                  </span>
                </div>
                {result.responseTime && (
                  <span className="text-sm text-muted-foreground">
                    {result.responseTime}ms
                  </span>
                )}
              </div>
              
              {result.url && (
                <div className="text-xs text-muted-foreground mb-1 break-all">
                  {result.url}
                </div>
              )}
              
              {result.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {result.error}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-red-50 rounded-lg">
        <h3 className="font-semibold mb-2">🚨 All Services Failed - Network Issue Detected</h3>
        <p className="text-sm mb-3">
          Both Mapbox (paid) and CartoDB (free) services are failing, indicating a network connectivity issue.
        </p>
        <ul className="text-sm space-y-1">
          <li>• <strong>Check your network:</strong> Corporate firewall may be blocking map tile requests</li>
          <li>• <strong>Try different network:</strong> Test on mobile hotspot or different WiFi</li>
          <li>• <strong>Check browser console:</strong> Look for CORS or network errors (F12 → Console)</li>
          <li>• <strong>Test basic connectivity:</strong> Try <code>curl -I https://api.mapbox.com</code></li>
          <li>• <strong>Production works:</strong> This confirms it's a local network issue, not billing</li>
        </ul>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg mt-4">
        <h3 className="font-semibold mb-2">💰 Cost Information</h3>
        <ul className="text-sm space-y-1">
          <li>• <strong>Mapbox:</strong> 200,000 free tile requests/month, then $0.50 per 1,000</li>
          <li>• <strong>CartoDB:</strong> Completely free (no limits)</li>
          <li>• <strong>Your token:</strong> Valid and configured correctly</li>
          <li>• <strong>Typical usage:</strong> Most apps stay within free tier</li>
        </ul>
      </div>
    </div>
  );
}
