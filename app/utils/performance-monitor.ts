/**
 * Performance monitoring utility for tracking page load times and component performance
 */

interface PerformanceMetric {
  startTime: number;
  endTime: number | null;
  duration: number | null;
}

interface CoreWebVitalMetric {
  value: number;
  timestamp: number;
}

interface NavigationTimings {
  dns: number;
  tcp: number;
  request: number;
  response: number;
  dom: number;
  load: number;
  total: number;
}

interface SlowResource {
  name: string;
  duration: number;
  size: number;
}

interface PerformanceReport {
  timestamp: string;
  url: string;
  userAgent: string;
  metrics: Record<string, any>;
  recommendations: string[];
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric | CoreWebVitalMetric | NavigationTimings | SlowResource[]>;
  private observers: Map<string, PerformanceObserver>;
  private isEnabled: boolean;

  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.isEnabled = typeof window !== 'undefined' && 'performance' in window;
  }

  /**
   * Start timing a specific operation
   */
  startTiming(name: string): void {
    if (!this.isEnabled) return;

    this.metrics.set(name, {
      startTime: performance.now(),
      endTime: null,
      duration: null
    });
  }

  /**
   * End timing for a specific operation
   */
  endTiming(name: string): number | undefined {
    if (!this.isEnabled) return;

    const metric = this.metrics.get(name) as PerformanceMetric;
    if (metric) {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;

      console.log(`⏱️ ${name}: ${metric.duration.toFixed(2)}ms`);
      return metric.duration;
    }
  }

  /**
   * Get timing for a specific operation
   */
  getTiming(name: string): PerformanceMetric | CoreWebVitalMetric | NavigationTimings | SlowResource[] | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all timings
   */
  getAllTimings(): Record<string, any> {
    const timings: Record<string, any> = {};
    for (const [name, metric] of this.metrics) {
      timings[name] = metric;
    }
    return timings;
  }

  /**
   * Measure component render time
   */
  measureComponent<T>(componentName: string, renderFunction: () => T): T {
    if (!this.isEnabled) return renderFunction();

    this.startTiming(`component_${componentName}`);
    const result = renderFunction();
    this.endTiming(`component_${componentName}`);

    return result;
  }

  /**
   * Measure async operation
   */
  async measureAsync<T>(name: string, asyncFunction: () => Promise<T>): Promise<T> {
    if (!this.isEnabled) return await asyncFunction();

    this.startTiming(name);
    try {
      const result = await asyncFunction();
      this.endTiming(name);
      return result;
    } catch (error) {
      this.endTiming(name);
      throw error;
    }
  }

  /**
   * Track Core Web Vitals
   */
  trackCoreWebVitals(): void {
    if (!this.isEnabled) return;

    // Track Largest Contentful Paint (LCP)
    this.observePerformanceEntry('largest-contentful-paint', (entries) => {
      const lastEntry = entries[entries.length - 1] as any;
      this.metrics.set('lcp', { value: lastEntry.startTime, timestamp: Date.now() });
    });

    // Track First Input Delay (FID)
    this.observePerformanceEntry('first-input', (entries) => {
      const firstEntry = entries[0] as any;
      const fid = firstEntry.processingStart - firstEntry.startTime;
      this.metrics.set('fid', { value: fid, timestamp: Date.now() });
    });

    // Track Cumulative Layout Shift (CLS)
    let clsValue = 0;
    this.observePerformanceEntry('layout-shift', (entries) => {
      for (const entry of entries) {
        const layoutShiftEntry = entry as any;
        if (!layoutShiftEntry.hadRecentInput) {
          clsValue += layoutShiftEntry.value;
        }
      }
      console.log('📐 CLS:', clsValue.toFixed(4));
      this.metrics.set('cls', { value: clsValue, timestamp: Date.now() });
    });
  }

  /**
   * Observe performance entries
   */
  observePerformanceEntry(type: string, callback: (entries: PerformanceEntry[]) => void): void {
    if (!this.isEnabled || !('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });

      observer.observe({ type, buffered: true });
      this.observers.set(type, observer);
    } catch (error) {
      console.warn(`Failed to observe ${type}:`, error);
    }
  }

  /**
   * Track navigation timing
   */
  trackNavigationTiming(): void {
    if (!this.isEnabled) return;

    // Wait for page load to complete
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          const timings: NavigationTimings = {
            dns: navigation.domainLookupEnd - navigation.domainLookupStart,
            tcp: navigation.connectEnd - navigation.connectStart,
            request: navigation.responseStart - navigation.requestStart,
            response: navigation.responseEnd - navigation.responseStart,
            dom: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            load: navigation.loadEventEnd - navigation.loadEventStart,
            total: navigation.loadEventEnd - navigation.navigationStart
          };

          console.log('🚀 Navigation Timings:', timings);
          this.metrics.set('navigation', timings);
        }
      }, 0);
    });
  }

  /**
   * Track resource loading performance
   */
  trackResourceTiming(): void {
    if (!this.isEnabled) return;

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const slowResources: SlowResource[] = resources
      .filter(resource => resource.duration > 1000) // Resources taking more than 1s
      .map(resource => ({
        name: resource.name,
        duration: resource.duration,
        size: resource.transferSize || 0
      }));

    if (slowResources.length > 0) {
      console.warn('🐌 Slow Resources:', slowResources);
      this.metrics.set('slow_resources', slowResources);
    }
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport | null {
    if (!this.isEnabled) return null;

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics: this.getAllTimings(),
      recommendations: this.generateRecommendations()
    };

    console.log('📊 Performance Report:', report);
    return report;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const lcp = this.metrics.get('lcp') as CoreWebVitalMetric;
    if (lcp && lcp.value > 2500) {
      recommendations.push('LCP is slow (>2.5s). Consider optimizing images and critical resources.');
    }

    const fid = this.metrics.get('fid') as CoreWebVitalMetric;
    if (fid && fid.value > 100) {
      recommendations.push('FID is slow (>100ms). Consider reducing JavaScript execution time.');
    }

    const cls = this.metrics.get('cls') as CoreWebVitalMetric;
    if (cls && cls.value > 0.1) {
      recommendations.push('CLS is high (>0.1). Consider setting dimensions for images and ads.');
    }

    const slowResources = this.metrics.get('slow_resources') as SlowResource[];
    if (slowResources && slowResources.length > 0) {
      recommendations.push(`${slowResources.length} resources are loading slowly. Consider optimization.`);
    }

    return recommendations;
  }

  /**
   * Clean up observers
   */
  cleanup(): void {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
  }
}

// Create global instance
const performanceMonitor = new PerformanceMonitor();

// Auto-start tracking when module loads
if (typeof window !== 'undefined') {
  performanceMonitor.trackCoreWebVitals();
  performanceMonitor.trackNavigationTiming();
  
  // Track resource timing after page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      performanceMonitor.trackResourceTiming();
    }, 1000);
  });

  // Generate report on page unload (for debugging) - only in development and less frequently
  if (process.env.NODE_ENV === 'development') {
    let reportGenerated = false;
    window.addEventListener('beforeunload', () => {
      if (!reportGenerated) {
        performanceMonitor.generateReport();
        reportGenerated = true;
      }
    });
  }
}

export default performanceMonitor;