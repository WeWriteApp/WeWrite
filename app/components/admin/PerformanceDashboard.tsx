"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Activity, 
  Zap, 
  Globe, 
  Image, 
  Database, 
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  target: number;
  unit: string;
}

interface NetworkBreakdown {
  type: string;
  percentage: number;
  avgLCP: number;
}

/**
 * PerformanceDashboard - Admin dashboard for monitoring WeWrite performance
 * 
 * Displays:
 * - Core Web Vitals metrics
 * - Network performance breakdown
 * - Bundle size analysis
 * - Slow resources tracking
 * - Performance recommendations
 */
export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [networkBreakdown, setNetworkBreakdown] = useState<NetworkBreakdown[]>([]);
  const [slowResources, setSlowResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadPerformanceData();
    // 🚨 EMERGENCY: Disable auto-refresh to stop 13K reads/min crisis
    // const interval = setInterval(loadPerformanceData, 30000); // Update every 30s
    // return () => clearInterval(interval);
    console.warn('🚨 EMERGENCY: PerformanceDashboard auto-refresh disabled to stop database read crisis');
  }, []);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      
      // Load Web Vitals data
      const vitalsResponse = await fetch('/api/analytics/web-vitals');
      const vitalsData = await vitalsResponse.json();
      
      // Load slow resources data
      const resourcesResponse = await fetch('/api/analytics/slow-resources');
      const resourcesData = await resourcesResponse.json();
      
      // Transform data for display
      const transformedMetrics: PerformanceMetric[] = [
        {
          name: 'LCP',
          value: vitalsData.metrics?.LCP?.p75 || 0,
          rating: vitalsData.metrics?.LCP?.rating || 'poor',
          target: 2500,
          unit: 'ms'
        },
        {
          name: 'FID',
          value: vitalsData.metrics?.FID?.p75 || 0,
          rating: vitalsData.metrics?.FID?.rating || 'good',
          target: 100,
          unit: 'ms'
        },
        {
          name: 'CLS',
          value: vitalsData.metrics?.CLS?.p75 || 0,
          rating: vitalsData.metrics?.CLS?.rating || 'good',
          target: 0.1,
          unit: ''
        }
      ];
      
      setMetrics(transformedMetrics);
      setNetworkBreakdown(vitalsData.networkBreakdown || []);
      setSlowResources(resourcesData.slowResources?.topOffenders || []);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600 bg-green-50 border-green-200';
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'good': return <CheckCircle className="h-4 w-4" />;
      case 'needs-improvement': return <AlertTriangle className="h-4 w-4" />;
      case 'poor': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading && metrics.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <div className="animate-pulse bg-muted h-8 w-32 rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-muted h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Performance Dashboard</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={loadPerformanceData}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Core Web Vitals Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((metric) => (
          <Card key={metric.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
              <div className={`p-1 rounded-full ${getRatingColor(metric.rating)}`}>
                {getRatingIcon(metric.rating)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metric.value.toFixed(metric.unit === 'ms' ? 0 : 3)}{metric.unit}
              </div>
              <div className="flex items-center justify-between mt-2">
                <Badge variant="secondary" className={getRatingColor(metric.rating)}>
                  {metric.rating.replace('-', ' ')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Target: {metric.target}{metric.unit}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="network" className="space-y-4">
        <TabsList>
          <TabsTrigger value="network">Network Analysis</TabsTrigger>
          <TabsTrigger value="resources">Slow Resources</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Network Performance Breakdown</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {networkBreakdown.map((network) => (
                  <div key={network.type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary">{network.type}</Badge>
                      <span className="text-sm">{network.percentage}% of users</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Avg LCP: {network.avgLCP}ms
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Slow Loading Resources</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {slowResources.map((resource, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{resource.name}</span>
                      <Badge variant="destructive">{resource.avgDuration}ms</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{resource.size}</span>
                      <span>{resource.category}</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground mb-1">Recommendations:</div>
                      <div className="flex flex-wrap gap-1">
                        {resource.recommendations?.map((rec: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {rec}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Performance Recommendations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="font-medium text-red-700">Critical Issues</h4>
                  <ul className="text-sm text-red-600 mt-1 space-y-1">
                    <li>• Implement dynamic loading for Mapbox components (1.51 MB)</li>
                    <li>• Split vendor bundle further (1.39 MB)</li>
                    <li>• Optimize Firebase bundle size (595 KB)</li>
                  </ul>
                </div>
                
                <div className="border-l-4 border-yellow-500 pl-4">
                  <h4 className="font-medium text-yellow-700">Improvements</h4>
                  <ul className="text-sm text-yellow-600 mt-1 space-y-1">
                    <li>• Implement responsive images across the application</li>
                    <li>• Add lazy loading for chart components</li>
                    <li>• Optimize API response sizes</li>
                  </ul>
                </div>
                
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium text-green-700">Completed</h4>
                  <ul className="text-sm text-green-600 mt-1 space-y-1">
                    <li>• ✅ Critical path JavaScript reduced by 99%</li>
                    <li>• ✅ Implemented code splitting for heavy dependencies</li>
                    <li>• ✅ Added service worker caching</li>
                    <li>• ✅ Optimized resource hints and preloading</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PerformanceDashboard;