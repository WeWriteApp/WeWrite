// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { contributorsApi } from '../utils/apiClient';
// REMOVED: updateUserContributorCount - contributor counting disabled for cost optimization

// Types
interface ContributorStats {
  count: number;
  uniqueContributors: string[];
}

/**
 * Service for managing contributor statistics with polling (cost optimized)
 * MIGRATED: Replaced real-time listeners with polling to reduce Firebase reads
 */
class ContributorsService {
  private pollingIntervals: Map<string, NodeJS.Timeout>;
  private cache: Map<string, { data: ContributorStats; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
  private readonly POLLING_INTERVAL = 2 * 60 * 1000; // 2 minutes polling

  constructor() {
    this.pollingIntervals = new Map();
    this.cache = new Map();
  }

  /**
   * Start polling for contributor count changes for a page
   * MIGRATED: Replaced real-time listener with polling for cost optimization
   */
  async startPollingContributors(pageId: string, callback: (stats: ContributorStats) => void): Promise<() => void> {
    if (!pageId || !callback) return () => {};

    console.log('👥 [CONTRIBUTORS SERVICE] Starting polling for page:', pageId);

    // Initial fetch
    await this.fetchAndCacheContributors(pageId, callback);

    // Set up polling interval
    const intervalId = setInterval(async () => {
      await this.fetchAndCacheContributors(pageId, callback);
    }, this.POLLING_INTERVAL);

    this.pollingIntervals.set(pageId, intervalId);

    // Return cleanup function
    return () => {
      const interval = this.pollingIntervals.get(pageId);
      if (interval) {
        clearInterval(interval);
        this.pollingIntervals.delete(pageId);
      }
      this.cache.delete(pageId);
      console.log('👥 [CONTRIBUTORS SERVICE] Stopped polling for page:', pageId);
    };
  }

  /**
   * Fetch and cache contributor data
   */
  private async fetchAndCacheContributors(pageId: string, callback: (stats: ContributorStats) => void): Promise<void> {
    try {
      // Check cache first
      const cached = this.cache.get(pageId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        callback(cached.data);
        return;
      }

      // Fetch from API
      const response = await contributorsApi.getContributors(pageId);
      if (response.success && response.data) {
        const stats: ContributorStats = {
          count: response.data.count || 0,
          uniqueContributors: response.data.uniqueContributors || []
        };

        // Cache the result
        this.cache.set(pageId, {
          data: stats,
          timestamp: Date.now()
        });

        callback(stats);
        console.log('👥 [CONTRIBUTORS SERVICE] Updated contributors for page:', pageId, 'count:', stats.count);
      } else {
        console.warn('👥 [CONTRIBUTORS SERVICE] Failed to fetch contributors:', response.error);
        // Return cached data if available, otherwise empty stats
        if (cached) {
          callback(cached.data);
        } else {
          callback({ count: 0, uniqueContributors: [] });
        }
      }
    } catch (error) {
      console.error('👥 [CONTRIBUTORS SERVICE] Error fetching contributors:', error);
      callback({ count: 0, uniqueContributors: [] });
    }
  }
  /**
   * Get contributor stats for a page (one-time fetch)
   * MIGRATED: Now uses API endpoint instead of direct Firebase query
   */
  async getContributorStats(pageId: string): Promise<ContributorStats> {
    if (!pageId) return { count: 0, uniqueContributors: [] };

    try {
      // Check cache first
      const cached = this.cache.get(pageId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      // Fetch from API
      const response = await contributorsApi.getContributors(pageId);
      if (response.success && response.data) {
        const stats: ContributorStats = {
          count: response.data.count || 0,
          uniqueContributors: response.data.uniqueContributors || []
        };

        // Cache the result
        this.cache.set(pageId, {
          data: stats,
          timestamp: Date.now()
        });

        return stats;
      } else {
        console.warn('👥 [CONTRIBUTORS SERVICE] Failed to fetch contributors:', response.error);
        return cached?.data || { count: 0, uniqueContributors: [] };
      }
    } catch (error) {
      console.error('👥 [CONTRIBUTORS SERVICE] Error getting contributor stats:', error);
      return { count: 0, uniqueContributors: [] };
    }
  }

  /**
   * Stop polling for a specific page
   */
  stopPolling(pageId: string): void {
    const interval = this.pollingIntervals.get(pageId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(pageId);
    }
    this.cache.delete(pageId);
    console.log('👥 [CONTRIBUTORS SERVICE] Stopped polling for page:', pageId);
  }

  /**
   * Clean up all polling intervals and cache
   */
  cleanup(): void {
    this.pollingIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
    this.cache.clear();
    console.log('👥 [CONTRIBUTORS SERVICE] Cleaned up all polling intervals');
  }
}

// Export a singleton instance
export const contributorsService = new ContributorsService();
export default contributorsService;