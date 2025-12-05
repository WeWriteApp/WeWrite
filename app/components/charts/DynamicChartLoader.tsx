"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useProgressiveLoading } from '../ui/progressive-loader';
import { BarChart3, TrendingUp, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { InlineError } from '../ui/InlineError';

interface ChartData {
  [key: string]: any;
}

interface DynamicChartProps {
  type: 'line' | 'bar' | 'pie' | 'area';
  data: ChartData[];
  width?: number;
  height?: number;
  title?: string;
  loading?: boolean;
  error?: string;
}

/**
 * DynamicChartLoader - Lazy-loaded chart components for performance
 * 
 * This component dynamically loads Recharts (380KB) only when charts are actually needed.
 * Provides fallbacks and progressive loading for poor network connections.
 * 
 * Features:
 * - Dynamic loading with intersection observer
 * - Network-aware loading delays
 * - Fallback visualizations
 * - Error handling with retry
 * - Skeleton loading states
 */

// Temporarily disable complex dynamic imports to fix webpack runtime error
// const RechartsComponents = dynamic(() => import('recharts'), {
//   loading: () => <ChartSkeleton type="line" />,
//   ssr: false,
// });

function ChartSkeleton({ type, height = 300 }: { type: string; height?: number }) {
  const getIcon = () => {
    switch (type) {
      case 'line': return <TrendingUp className="h-8 w-8" />;
      case 'bar': return <BarChart3 className="h-8 w-8" />;
      case 'pie': return <PieChartIcon className="h-8 w-8" />;
      case 'area': return <Activity className="h-8 w-8" />;
      default: return <BarChart3 className="h-8 w-8" />;
    }
  };

  return (
    <div 
      className="w-full bg-muted/20 rounded-lg border border-border/40 flex items-center justify-center"
      style={{ height }}
    >
      <div className="flex flex-col items-center space-y-3 text-muted-foreground">
        <div className="animate-pulse">
          {getIcon()}
        </div>
        <div className="text-sm">Loading chart...</div>
      </div>
    </div>
  );
}

function ChartFallback({ 
  type, 
  data, 
  title, 
  height = 300,
  onLoadChart 
}: { 
  type: string;
  data: ChartData[];
  title?: string;
  height?: number;
  onLoadChart: () => void;
}) {
  const getSimpleVisualization = () => {
    if (!data || data.length === 0) {
      return <div className="text-sm text-muted-foreground">No data available</div>;
    }

    // Simple text-based data representation
    const firstKey = Object.keys(data[0]).find(key => typeof data[0][key] === 'number');
    if (!firstKey) {
      return <div className="text-sm text-muted-foreground">Invalid data format</div>;
    }

    const values = data.map(item => item[firstKey]).filter(val => typeof val === 'number');
    const max = Math.max(...values);
    const min = Math.min(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

    return (
      <div className="space-y-2 text-sm">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Min</div>
            <div className="font-medium">{min.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Avg</div>
            <div className="font-medium">{avg.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Max</div>
            <div className="font-medium">{max.toFixed(1)}</div>
          </div>
        </div>
        
        {/* Simple bar representation */}
        <div className="space-y-1">
          {data.slice(0, 5).map((item, index) => {
            const value = item[firstKey];
            const percentage = ((value - min) / (max - min)) * 100;
            return (
              <div key={index} className="flex items-center space-x-2">
                <div className="text-xs w-12 text-muted-foreground">
                  {item.name || `#${index + 1}`}
                </div>
                <div className="flex-1 bg-muted/30 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-xs w-12 text-right">{value}</div>
              </div>
            );
          })}
          {data.length > 5 && (
            <div className="text-xs text-muted-foreground text-center pt-1">
              +{data.length - 5} more items
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div 
      className="w-full bg-muted/10 rounded-lg border border-border/40 p-4"
      style={{ height }}
    >
      <div className="flex flex-col h-full">
        {title && (
          <h3 className="text-sm font-medium mb-3">{title}</h3>
        )}
        
        <div className="flex-1 flex flex-col justify-center">
          {getSimpleVisualization()}
        </div>
        
        <div className="pt-3 border-t border-border/40 mt-3">
          <button
            onClick={onLoadChart}
            className="w-full px-3 py-2 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
          >
            Load Interactive Chart
          </button>
        </div>
      </div>
    </div>
  );
}

export function DynamicChart({
  type,
  data,
  width = 400,
  height = 300,
  title,
  loading = false,
  error}: DynamicChartProps) {
  const [shouldLoadChart, setShouldLoadChart] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasUserRequested, setHasUserRequested] = useState(false);
  const { isSlowConnection, shouldDefer } = useProgressiveLoading();
  const elementRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for visibility-based loading
  useEffect(() => {
    if (shouldLoadChart) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Auto-load for fast connections when visible
          if (!shouldDefer) {
            setTimeout(() => setShouldLoadChart(true), 500);
          }
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [shouldLoadChart, shouldDefer]);

  const handleLoadChart = () => {
    setHasUserRequested(true);
    setShouldLoadChart(true);
  };

  // Show loading state
  if (loading) {
    return <ChartSkeleton type={type} height={height} />;
  }

  // Show error state
  if (error) {
    return (
      <InlineError
        variant="card"
        title="Failed to load chart"
        message={error}
        style={{ height }}
        className="w-full flex items-center justify-center"
      />
    );
  }

  // Show fallback for slow connections or when not yet loaded
  if (!shouldLoadChart && (!isVisible || shouldDefer || !hasUserRequested)) {
    return (
      <div ref={elementRef}>
        <ChartFallback
          type={type}
          data={data}
          title={title}
          height={height}
          onLoadChart={handleLoadChart}
        />
      </div>
    );
  }

  // Render the actual chart
  const chartProps = {
    width,
    height,
    data,
    margin: { top: 5, right: 30, left: 20, bottom: 5 }};

  return (
    <div ref={elementRef} className="w-full">
      {title && <h3 className="text-sm font-medium mb-2">{title}</h3>}
      
      {/* Temporarily disabled complex charts to fix webpack runtime error */}
      <div className="w-full bg-muted/10 rounded-lg border border-muted/20 flex items-center justify-center p-4" style={{ height }}>
        <div className="text-center space-y-2">
          <div className="text-muted-foreground text-sm">Chart temporarily disabled</div>
          <div className="text-xs text-muted-foreground">Fixing webpack runtime issues</div>
        </div>
      </div>
    </div>
  );
}

export default DynamicChart;