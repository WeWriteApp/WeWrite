/**
 * Analytics Cache - Wrapper around serverCache for backwards compatibility
 *
 * This module now uses the unified serverCache for analytics operations.
 * The specialized EnhancedAnalyticsCache has been deprecated in favor of
 * the simpler, more maintainable serverCache implementation.
 *
 * @deprecated Use cachedQuery from serverCache.ts directly for new code
 */

import { analyticsCache as serverAnalyticsCache, CACHE_TTL } from './serverCache';

// Re-export the serverCache analytics instance with a compatible interface
class AnalyticsCacheAdapter {
  private generateKey(analyticsType: string, params: any = {}): string {
    const keyParts = [
      'analytics',
      analyticsType,
      params.dateRange || '',
      params.granularity || '',
      params.userId || '',
      params.type || ''
    ].filter(Boolean);
    return keyParts.join(':');
  }

  get(analyticsType: string, params: any = {}): any | null {
    const key = this.generateKey(analyticsType, params);
    return serverAnalyticsCache.get(key);
  }

  set(analyticsType: string, data: any, params: any = {}, _computationCost?: number): void {
    const key = this.generateKey(analyticsType, params);
    // Use longer TTL for analytics since data changes less frequently
    serverAnalyticsCache.set(key, data, CACHE_TTL.ANALYTICS * 6); // 30-60s * 6 = 3-6 minutes
  }

  getStats() {
    return {
      ...serverAnalyticsCache.getStats(),
      hitRate: serverAnalyticsCache.getStats().hitRate || 0,
      size: serverAnalyticsCache.size(),
      tierBreakdown: { hot: 0, warm: 0, cold: 0 }, // Simplified - no tiers
      typeBreakdown: { dashboard: 0, pages: 0, users: 0, events: 0, aggregated: 0 }
    };
  }

  clear(): void {
    serverAnalyticsCache.clear();
  }

  clearByType(analyticsType: string): void {
    serverAnalyticsCache.invalidate(new RegExp(`^analytics:${analyticsType}:`));
  }

  clearByDateRange(dateRange: string): void {
    serverAnalyticsCache.invalidate(new RegExp(`analytics:.*:${dateRange}`));
  }

  cleanup(): void {
    // Cleanup is handled by serverCache automatically
  }

  async precomputeCommonAnalytics(): Promise<void> {
    // No-op - precomputation removed for simplicity
    console.log('[AnalyticsCache] Precomputation disabled - using on-demand caching');
  }
}

// Export singleton instance for backwards compatibility
export const analyticsCache = new AnalyticsCacheAdapter();
