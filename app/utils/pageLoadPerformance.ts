/**
 * Page Load Performance Monitoring
 * Tracks and optimizes page loading performance
 */

interface PerformanceMetrics {
  pageId: string;
  loadStartTime: number;
  apiCallTime?: number;
  renderTime?: number;
  totalTime?: number;
  cacheHit?: boolean;
  errorOccurred?: boolean;
}

class PageLoadPerformanceMonitor {
  private metrics = new Map<string, PerformanceMetrics>();

  startPageLoad(pageId: string): void {
    this.metrics.set(pageId, {
      pageId,
      loadStartTime: Date.now(),
    });
  }

  recordApiCall(pageId: string, duration: number, cacheHit: boolean = false): void {
    const metric = this.metrics.get(pageId);
    if (metric) {
      metric.apiCallTime = duration;
      metric.cacheHit = cacheHit;
    }
  }

  recordRender(pageId: string): void {
    const metric = this.metrics.get(pageId);
    if (metric) {
      metric.renderTime = Date.now() - metric.loadStartTime;
    }
  }

  recordError(pageId: string): void {
    const metric = this.metrics.get(pageId);
    if (metric) {
      metric.errorOccurred = true;
    }
  }

  finishPageLoad(pageId: string): PerformanceMetrics | null {
    const metric = this.metrics.get(pageId);
    if (metric) {
      metric.totalTime = Date.now() - metric.loadStartTime;
      
      // Log performance metrics
      this.logPerformance(metric);
      
      // Clean up
      this.metrics.delete(pageId);
      
      return metric;
    }
    return null;
  }

  private logPerformance(metric: PerformanceMetrics): void {
    const { pageId, totalTime, apiCallTime, cacheHit, errorOccurred } = metric;
    
    if (errorOccurred) {
      console.warn(`⚠️ Page load error for ${pageId} after ${totalTime}ms`);
      return;
    }

    if (totalTime && totalTime > 2000) {
      console.warn(`🐌 Slow page load for ${pageId}: ${totalTime}ms (API: ${apiCallTime}ms, Cache: ${cacheHit ? 'HIT' : 'MISS'})`);
    } else if (totalTime && totalTime < 500) {
      console.log(`⚡ Fast page load for ${pageId}: ${totalTime}ms (Cache: ${cacheHit ? 'HIT' : 'MISS'})`);
    } else {
      console.log(`📄 Page load for ${pageId}: ${totalTime}ms (API: ${apiCallTime}ms, Cache: ${cacheHit ? 'HIT' : 'MISS'})`);
    }

    // Send to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_load_performance', {
        page_id: pageId,
        load_time: totalTime,
        api_time: apiCallTime,
        cache_hit: cacheHit,
        error_occurred: errorOccurred,
      });
    }
  }

  getAverageLoadTime(): number {
    const completedMetrics = Array.from(this.metrics.values()).filter(m => m.totalTime);
    if (completedMetrics.length === 0) return 0;
    
    const total = completedMetrics.reduce((sum, m) => sum + (m.totalTime || 0), 0);
    return total / completedMetrics.length;
  }

  getCacheHitRate(): number {
    const completedMetrics = Array.from(this.metrics.values()).filter(m => m.totalTime);
    if (completedMetrics.length === 0) return 0;
    
    const cacheHits = completedMetrics.filter(m => m.cacheHit).length;
    return cacheHits / completedMetrics.length;
  }
}

// Export singleton instance
export const pageLoadMonitor = new PageLoadPerformanceMonitor();

// Helper functions for easy integration
export const startPageLoadTracking = (pageId: string) => {
  pageLoadMonitor.startPageLoad(pageId);
};

export const recordApiCallTime = (pageId: string, duration: number, cacheHit: boolean = false) => {
  pageLoadMonitor.recordApiCall(pageId, duration, cacheHit);
};

export const recordPageRender = (pageId: string) => {
  pageLoadMonitor.recordRender(pageId);
};

export const recordPageError = (pageId: string) => {
  pageLoadMonitor.recordError(pageId);
};

export const finishPageLoadTracking = (pageId: string) => {
  return pageLoadMonitor.finishPageLoad(pageId);
};
