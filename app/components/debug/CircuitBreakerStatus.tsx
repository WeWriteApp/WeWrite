"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { getRefreshStatus, getHardResetIncidents, clearHardResetIncidents } from '../../utils/page-refresh-protection';
import { pageRefreshCircuitBreaker } from '../../utils/circuit-breaker';

interface CircuitBreakerStatusProps {
  pageId: string;
  show?: boolean;
}

export function CircuitBreakerStatus({ pageId, show = false }: CircuitBreakerStatusProps) {
  const [status, setStatus] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (!isVisible) return;

    const updateStatus = () => {
      try {
        const currentStatus = getRefreshStatus(pageId);
        const currentIncidents = getHardResetIncidents();
        setStatus(currentStatus);
        setIncidents(currentIncidents);
      } catch (error) {
        console.error('Error updating circuit breaker status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [pageId, isVisible]);

  // Only show in development or when explicitly enabled
  if (!isVisible && process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="bg-background/80 backdrop-blur-sm"
        >
          Circuit Breaker Debug
        </Button>
      </div>
    );
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="bg-background/95 backdrop-blur-sm border-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Circuit Breaker Status</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {status && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Page ID:</span>
                <span className="text-xs font-mono">{status.pageId.substring(0, 8)}...</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge variant={status.isBlocked ? "destructive" : "default"} className="text-xs">
                  {status.isBlocked ? "BLOCKED" : "ACTIVE"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Refresh Count:</span>
                <span className="text-xs">{status.refreshCount}/{status.threshold}</span>
              </div>
              
              {status.isBlocked && status.timeUntilReset > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Reset In:</span>
                  <span className="text-xs">{formatTime(status.timeUntilReset)}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Since First:</span>
                <span className="text-xs">{formatTime(status.timeSinceFirstRefresh)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Last Activity:</span>
                <span className="text-xs">{formatTime(status.timeSinceLastActivity)}</span>
              </div>
            </div>
          )}
          
          {incidents.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Recent Incidents:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearHardResetIncidents();
                    setIncidents([]);
                  }}
                  className="h-5 text-xs"
                >
                  Clear
                </Button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {incidents.slice(-3).map((incident, index) => (
                  <div key={index} className="text-xs p-2 bg-destructive/10 rounded border">
                    <div className="font-medium">{incident.reason}</div>
                    <div className="text-muted-foreground">
                      {new Date(incident.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                pageRefreshCircuitBreaker.resetPageData(pageId);
                setStatus(getRefreshStatus(pageId));
              }}
              className="text-xs h-6"
            >
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('Circuit Breaker Status:', status);
                console.log('Circuit Breaker Incidents:', incidents);
              }}
              className="text-xs h-6"
            >
              Log
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CircuitBreakerStatus;
