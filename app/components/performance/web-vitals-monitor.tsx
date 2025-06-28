"use client";

import { useEffect, useRef } from 'react';
import { onCLS, onFID, onFCP, onLCP, onTTFB } from 'web-vitals';

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

interface NetworkInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

/**
 * WebVitalsMonitor - Comprehensive performance monitoring for poor network connections
 * 
 * Tracks:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Additional metrics (FCP, TTFB)
 * - Network conditions
 * - User experience metrics
 * - Performance budgets
 */
export function WebVitalsMonitor() {
  const metricsRef = useRef<Map<string, WebVitalsMetric>>(new Map());
  const networkInfoRef = useRef<NetworkInfo>({});
  const performanceBudgets = {
    LCP: 2500, // 2.5s for good rating
    FID: 100,  // 100ms for good rating
    CLS: 0.1,  // 0.1 for good rating
    FCP: 1800, // 1.8s target
    TTFB: 800, // 800ms target
  };

  useEffect(() => {
    // Initialize network monitoring
    initializeNetworkMonitoring();
    
    // Initialize Web Vitals monitoring
    initializeWebVitalsMonitoring();
    
    // Monitor resource loading
    monitorResourceLoading();
    
    // Monitor user interactions
    monitorUserInteractions();
    
    // Set up periodic reporting
    const reportingInterval = setInterval(reportMetrics, 30000); // Report every 30s
    
    return () => {
      clearInterval(reportingInterval);
    };
  }, []);

  const initializeNetworkMonitoring = () => {
    if (typeof navigator === 'undefined') return;
    
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      const updateNetworkInfo = () => {
        networkInfoRef.current = {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        };
        
        // Log network changes for debugging
        console.log('Network conditions:', networkInfoRef.current);
        
        // Report network-specific metrics
        reportNetworkMetrics();
      };
      
      updateNetworkInfo();
      connection.addEventListener('change', updateNetworkInfo);
    }
  };

  const initializeWebVitalsMonitoring = () => {
    const handleMetric = (metric: any) => {
      const webVitalsMetric: WebVitalsMetric = {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType || 'unknown',
      };
      
      metricsRef.current.set(metric.name, webVitalsMetric);
      
      // Check against performance budgets
      checkPerformanceBudget(webVitalsMetric);
      
      // Send to analytics
      sendMetricToAnalytics(webVitalsMetric);
    };

    // Monitor Core Web Vitals
    onCLS(handleMetric);
    onFID(handleMetric);
    onLCP(handleMetric);
    onFCP(handleMetric);
    onTTFB(handleMetric);
  };

  const monitorResourceLoading = () => {
    if (typeof window === 'undefined') return;
    
    // Monitor resource timing
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          const resourceEntry = entry as PerformanceResourceTiming;
          
          // Track slow resources
          if (resourceEntry.duration > 3000) { // 3s threshold
            console.warn('Slow resource detected:', {
              name: resourceEntry.name,
              duration: resourceEntry.duration,
              size: resourceEntry.transferSize,
              type: resourceEntry.initiatorType,
            });
            
            // Report slow resources
            sendSlowResourceAlert(resourceEntry);
          }
        }
      }
    });
    
    observer.observe({ entryTypes: ['resource'] });
  };

  const monitorUserInteractions = () => {
    if (typeof window === 'undefined') return;
    
    let interactionCount = 0;
    let totalInteractionDelay = 0;
    
    const trackInteraction = (event: Event) => {
      const startTime = performance.now();
      
      // Use requestIdleCallback to measure interaction delay
      requestIdleCallback(() => {
        const delay = performance.now() - startTime;
        interactionCount++;
        totalInteractionDelay += delay;
        
        // Track slow interactions
        if (delay > 100) { // 100ms threshold
          console.warn('Slow interaction detected:', {
            type: event.type,
            delay,
            target: (event.target as Element)?.tagName,
          });
        }
      });
    };
    
    // Monitor key interaction events
    ['click', 'keydown', 'touchstart'].forEach(eventType => {
      document.addEventListener(eventType, trackInteraction, { passive: true });
    });
  };

  const checkPerformanceBudget = (metric: WebVitalsMetric) => {
    const budget = performanceBudgets[metric.name as keyof typeof performanceBudgets];
    
    if (budget && metric.value > budget) {
      console.warn(`Performance budget exceeded for ${metric.name}:`, {
        value: metric.value,
        budget,
        rating: metric.rating,
        networkConditions: networkInfoRef.current,
      });
      
      // Send budget violation alert
      sendBudgetViolationAlert(metric, budget);
    }
  };

  const sendMetricToAnalytics = (metric: WebVitalsMetric) => {
    // Send to analytics service
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', metric.name, {
        event_category: 'Web Vitals',
        event_label: metric.id,
        value: Math.round(metric.value),
        custom_map: {
          metric_rating: metric.rating,
          network_type: networkInfoRef.current.effectiveType,
        },
      });
    }
    
    // Send to custom analytics endpoint
    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric,
        networkInfo: networkInfoRef.current,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      }),
    }).catch(error => {
      console.error('Failed to send web vitals metric:', error);
    });
  };

  const sendSlowResourceAlert = (resource: PerformanceResourceTiming) => {
    fetch('/api/analytics/slow-resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: resource.name,
        duration: resource.duration,
        transferSize: resource.transferSize,
        initiatorType: resource.initiatorType,
        networkInfo: networkInfoRef.current,
        timestamp: Date.now(),
      }),
    }).catch(error => {
      console.error('Failed to send slow resource alert:', error);
    });
  };

  const sendBudgetViolationAlert = (metric: WebVitalsMetric, budget: number) => {
    fetch('/api/analytics/budget-violations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: metric.name,
        value: metric.value,
        budget,
        rating: metric.rating,
        networkInfo: networkInfoRef.current,
        timestamp: Date.now(),
      }),
    }).catch(error => {
      console.error('Failed to send budget violation alert:', error);
    });
  };

  const reportNetworkMetrics = () => {
    const networkInfo = networkInfoRef.current;
    
    // Report network-specific insights
    if (networkInfo.effectiveType) {
      const isSlowConnection = ['slow-2g', '2g', '3g'].includes(networkInfo.effectiveType);
      
      if (isSlowConnection) {
        console.log('Slow network detected, optimizing experience:', networkInfo);
        
        // Trigger performance optimizations for slow networks
        document.dispatchEvent(new CustomEvent('slowNetworkDetected', {
          detail: networkInfo
        }));
      }
    }
  };

  const reportMetrics = () => {
    const currentMetrics = Array.from(metricsRef.current.values());
    
    if (currentMetrics.length > 0) {
      console.log('Current Web Vitals:', {
        metrics: currentMetrics,
        networkInfo: networkInfoRef.current,
        timestamp: new Date().toISOString(),
      });
    }
  };

  // This component doesn't render anything visible
  return null;
}

/**
 * Hook for accessing current performance metrics
 */
export function useWebVitals() {
  const metricsRef = useRef<Map<string, WebVitalsMetric>>(new Map());
  
  const getMetric = (name: string): WebVitalsMetric | undefined => {
    return metricsRef.current.get(name);
  };
  
  const getAllMetrics = (): WebVitalsMetric[] => {
    return Array.from(metricsRef.current.values());
  };
  
  return {
    getMetric,
    getAllMetrics,
  };
}

export default WebVitalsMonitor;
