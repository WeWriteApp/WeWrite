"use client";

import React from 'react';
import { TrendingDown, Users, ArrowDown, AlertTriangle } from 'lucide-react';
import { useSubscriptionConversionFunnel } from '../../hooks/usePaymentAnalytics';
import { type DateRange } from '../../services/dashboardAnalytics';
import { ErrorCard } from '../ui/ErrorCard';

interface SubscriptionConversionFunnelWidgetProps {
  dateRange: DateRange;
  className?: string;
}

export function SubscriptionConversionFunnelWidget({ 
  dateRange, 
  className = "" 
}: SubscriptionConversionFunnelWidgetProps) {
  const { data, loading, error } = useSubscriptionConversionFunnel(dateRange);

  // Handle loading state
  if (loading) {
    return (
      <div className={`wewrite-card ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="text-lg font-semibold">Subscription Conversion Funnel</h3>
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-muted rounded w-48"></div>
                <div className="h-4 bg-muted rounded w-16"></div>
              </div>
              <div className="h-8 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <ErrorCard 
        title="Error loading conversion funnel"
        message={error}
        className={className}
      />
    );
  }

  // Check if we have any data
  const hasData = data && data.length > 0;
  const totalInitiated = hasData ? data[0]?.count || 0 : 0;

  // Calculate overall conversion rate with NaN protection
  const finalConversionRate = hasData && data.length > 3 ? data[3]?.conversionRate || 0 : 0;
  const safeFinalConversionRate = isNaN(finalConversionRate) ? 0 : finalConversionRate;

  const biggestDropOff = hasData ? Math.max(...data.map(stage => stage.dropOffRate)) : 0;
  const safeBiggestDropOff = isNaN(biggestDropOff) ? 0 : biggestDropOff;
  const biggestDropOffStage = hasData ? data.find(stage => stage.dropOffRate === biggestDropOff)?.stageName : '';

  return (
    <div className={`wewrite-card ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Subscription Conversion Funnel</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{safeFinalConversionRate.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">
            Overall conversion
          </div>
        </div>
      </div>

      {/* Key Insights */}
      {hasData && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <div className="text-sm">
            <span className="font-medium">Biggest bottleneck:</span> {biggestDropOffStage}
            <span className="text-muted-foreground"> ({safeBiggestDropOff.toFixed(1)}% drop-off)</span>
          </div>
        </div>
      )}

      {/* Funnel Visualization */}
      <div className="space-y-3">
        {hasData ? (
          data.map((stage, index) => {
            const isFirst = index === 0;
            const widthPercentage = isFirst ? 100 : (stage.count / totalInitiated) * 100;
            const barColor = stage.dropOffRate > 30 ? 'bg-red-500' : 
                           stage.dropOffRate > 15 ? 'bg-amber-500' : 'bg-green-500';
            
            return (
              <div key={stage.stage} className="space-y-2">
                {/* Stage Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{stage.stageName}</span>
                    {!isFirst && (
                      <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium">{stage.count.toLocaleString()}</span>
                    <span className="text-muted-foreground">
                      {isNaN(stage.conversionRate) ? '0.0' : stage.conversionRate.toFixed(1)}%
                    </span>
                    {!isFirst && stage.dropOffRate > 0 && (
                      <span className="text-red-600 text-xs">
                        -{isNaN(stage.dropOffRate) ? '0.0' : stage.dropOffRate.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Funnel Bar */}
                <div className="relative">
                  <div className="w-full h-8 bg-muted rounded-lg overflow-hidden">
                    <div 
                      className={`h-full ${barColor} transition-all duration-500 ease-out flex items-center justify-center`}
                      style={{ width: `${Math.max(widthPercentage, 5)}%` }}
                    >
                      {stage.count > 0 && (
                        <span className="text-white text-xs font-medium">
                          {stage.count.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stage Description */}
                <div className="text-xs text-muted-foreground pl-1">
                  {stage.description}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No conversion data available for this period</p>
            <p className="text-xs text-muted-foreground mt-1">
              Conversion tracking requires subscription flow analytics events
            </p>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {hasData && totalInitiated > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-primary">{totalInitiated.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Started</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {data[3]?.count.toLocaleString() || '0'}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">
                {data[5]?.count.toLocaleString() || '0'}
              </div>
              <div className="text-xs text-muted-foreground">Ongoing</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}