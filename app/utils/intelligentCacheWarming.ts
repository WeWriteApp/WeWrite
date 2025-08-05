'use client';

/**
 * Intelligent Cache Warming System
 * 
 * Replaces aggressive cache warming with smart, behavior-driven preloading
 * to reduce unnecessary database reads while maintaining performance.
 * 
 * Features:
 * - User behavior pattern analysis
 * - Frequency-based warming decisions
 * - Time-of-day optimization
 * - Resource usage tracking
 * - Adaptive warming intervals
 */

import { getCacheItem, setCacheItem, generateCacheKey } from './cacheUtils';

interface UserBehaviorPattern {
  userId: string;
  frequentPages: Map<string, number>; // pageId -> access count
  frequentEndpoints: Map<string, number>; // endpoint -> access count
  accessTimes: number[]; // Array of access timestamps
  lastActive: number;
  sessionCount: number;
}

interface WarmingCandidate {
  id: string;
  type: 'page' | 'user' | 'endpoint';
  resourceId: string;
  priority: number;
  frequency: number;
  lastAccessed: number;
  estimatedValue: number; // Cost-benefit score
}

interface WarmingStats {
  totalWarmed: number;
  successfulWarms: number;
  skippedWarms: number;
  costSavings: number;
  lastAnalysis: number;
}

class IntelligentCacheWarmingManager {
  private userPatterns = new Map<string, UserBehaviorPattern>();
  private warmingCandidates: WarmingCandidate[] = [];
  private isAnalyzing = false;
  private isWarming = false;
  private stats: WarmingStats = {
    totalWarmed: 0,
    successfulWarms: 0,
    skippedWarms: 0,
    costSavings: 0,
    lastAnalysis: 0
  };

  // Configuration
  private readonly MIN_ACCESS_FREQUENCY = 3; // Minimum accesses to consider warming
  private readonly ANALYSIS_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_WARMING_CANDIDATES = 10; // Limit warming to top candidates
  private readonly WARMING_COOLDOWN = 60 * 60 * 1000; // 1 hour between warming sessions

  constructor() {
    this.loadUserPatterns();
    this.setupPeriodicAnalysis();
  }

  /**
   * Track user access to resources for behavior analysis
   */
  trackAccess(userId: string, resourceType: 'page' | 'endpoint', resourceId: string): void {
    if (!userId || !resourceId) return;

    let pattern = this.userPatterns.get(userId);
    if (!pattern) {
      pattern = {
        userId,
        frequentPages: new Map(),
        frequentEndpoints: new Map(),
        accessTimes: [],
        lastActive: Date.now(),
        sessionCount: 1
      };
      this.userPatterns.set(userId, pattern);
    }

    // Update access patterns
    const now = Date.now();
    pattern.lastActive = now;
    pattern.accessTimes.push(now);

    // Keep only last 100 access times for analysis
    if (pattern.accessTimes.length > 100) {
      pattern.accessTimes = pattern.accessTimes.slice(-100);
    }

    // Track resource frequency
    if (resourceType === 'page') {
      const currentCount = pattern.frequentPages.get(resourceId) || 0;
      pattern.frequentPages.set(resourceId, currentCount + 1);
    } else if (resourceType === 'endpoint') {
      const currentCount = pattern.frequentEndpoints.get(resourceId) || 0;
      pattern.frequentEndpoints.set(resourceId, currentCount + 1);
    }

    // Persist patterns periodically
    if (Math.random() < 0.1) { // 10% chance to save
      this.saveUserPatterns();
    }

    console.log(`🧠 [IntelligentWarming] Tracked ${resourceType} access: ${resourceId} for user ${userId}`);
  }

  /**
   * Analyze user patterns and identify warming candidates
   */
  private async analyzePatterns(): Promise<void> {
    if (this.isAnalyzing) return;
    
    this.isAnalyzing = true;
    const startTime = Date.now();

    try {
      console.log('🧠 [IntelligentWarming] Starting pattern analysis...');
      
      this.warmingCandidates = [];
      const now = Date.now();

      for (const [userId, pattern] of this.userPatterns.entries()) {
        // Skip inactive users (no activity in last 7 days)
        if (now - pattern.lastActive > 7 * 24 * 60 * 60 * 1000) {
          continue;
        }

        // Analyze frequent pages
        for (const [pageId, frequency] of pattern.frequentPages.entries()) {
          if (frequency >= this.MIN_ACCESS_FREQUENCY) {
            const candidate: WarmingCandidate = {
              id: `page-${pageId}-${userId}`,
              type: 'page',
              resourceId: pageId,
              priority: this.calculatePriority(frequency, pattern.accessTimes),
              frequency,
              lastAccessed: pattern.lastActive,
              estimatedValue: this.calculateEstimatedValue(frequency, 'page')
            };
            this.warmingCandidates.push(candidate);
          }
        }

        // Analyze frequent endpoints
        for (const [endpoint, frequency] of pattern.frequentEndpoints.entries()) {
          if (frequency >= this.MIN_ACCESS_FREQUENCY) {
            const candidate: WarmingCandidate = {
              id: `endpoint-${endpoint}-${userId}`,
              type: 'endpoint',
              resourceId: endpoint,
              priority: this.calculatePriority(frequency, pattern.accessTimes),
              frequency,
              lastAccessed: pattern.lastActive,
              estimatedValue: this.calculateEstimatedValue(frequency, 'endpoint')
            };
            this.warmingCandidates.push(candidate);
          }
        }
      }

      // Sort candidates by estimated value (cost-benefit)
      this.warmingCandidates.sort((a, b) => b.estimatedValue - a.estimatedValue);
      
      // Limit to top candidates
      this.warmingCandidates = this.warmingCandidates.slice(0, this.MAX_WARMING_CANDIDATES);

      this.stats.lastAnalysis = now;
      
      console.log(`🧠 [IntelligentWarming] Analysis complete: ${this.warmingCandidates.length} candidates identified in ${Date.now() - startTime}ms`);
      
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Calculate priority based on frequency and recency
   */
  private calculatePriority(frequency: number, accessTimes: number[]): number {
    const now = Date.now();
    const recentAccesses = accessTimes.filter(time => now - time < 24 * 60 * 60 * 1000).length;
    
    // Combine frequency with recency
    return frequency * 0.7 + recentAccesses * 0.3;
  }

  /**
   * Calculate estimated value (cost-benefit score)
   */
  private calculateEstimatedValue(frequency: number, type: 'page' | 'endpoint'): number {
    // Estimate cost savings based on frequency and resource type
    const baseCost = type === 'page' ? 0.002 : 0.001; // Estimated cost per read
    const potentialSavings = frequency * baseCost;
    
    // Factor in warming cost (negative value)
    const warmingCost = 0.0005; // Cost of warming operation
    
    return potentialSavings - warmingCost;
  }

  /**
   * Execute intelligent cache warming
   */
  async executeIntelligentWarming(): Promise<void> {
    if (this.isWarming) return;
    
    // Check cooldown
    const now = Date.now();
    if (now - this.stats.lastAnalysis < this.WARMING_COOLDOWN) {
      console.log('🧠 [IntelligentWarming] Skipping warming - cooldown active');
      return;
    }

    this.isWarming = true;

    try {
      // Analyze patterns first
      await this.analyzePatterns();

      if (this.warmingCandidates.length === 0) {
        console.log('🧠 [IntelligentWarming] No warming candidates identified');
        this.stats.skippedWarms++;
        return;
      }

      console.log(`🧠 [IntelligentWarming] Starting intelligent warming for ${this.warmingCandidates.length} candidates`);

      // Warm only the most valuable candidates
      for (const candidate of this.warmingCandidates.slice(0, 5)) { // Top 5 only
        try {
          await this.warmCandidate(candidate);
          this.stats.successfulWarms++;
          this.stats.costSavings += candidate.estimatedValue;
          
          // Add delay between warming operations
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`🧠 [IntelligentWarming] Failed to warm candidate ${candidate.id}:`, error);
        }
      }

      console.log('🧠 [IntelligentWarming] Intelligent warming session completed');

    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm a specific candidate
   */
  private async warmCandidate(candidate: WarmingCandidate): Promise<void> {
    const cacheKey = generateCacheKey(candidate.type, candidate.resourceId);
    
    // Check if already cached
    const existing = getCacheItem(cacheKey);
    if (existing) {
      console.log(`🧠 [IntelligentWarming] Skipping ${candidate.id} - already cached`);
      return;
    }

    let data: any = null;

    try {
      if (candidate.type === 'page') {
        const response = await fetch(`/api/pages/${candidate.resourceId}`);
        data = response.ok ? await response.json() : null;
      } else if (candidate.type === 'endpoint') {
        const response = await fetch(candidate.resourceId);
        data = response.ok ? await response.json() : null;
      }

      if (data) {
        setCacheItem(cacheKey, data, 30 * 60 * 1000); // 30 minutes cache
        console.log(`🧠 [IntelligentWarming] Successfully warmed ${candidate.id}`);
        this.stats.totalWarmed++;
      }

    } catch (error) {
      console.error(`🧠 [IntelligentWarming] Error warming ${candidate.id}:`, error);
    }
  }

  /**
   * Setup periodic pattern analysis
   */
  private setupPeriodicAnalysis(): void {
    // Run analysis every 30 minutes
    setInterval(() => {
      this.executeIntelligentWarming();
    }, this.ANALYSIS_INTERVAL);

    // Initial analysis after 5 minutes
    setTimeout(() => {
      this.executeIntelligentWarming();
    }, 5 * 60 * 1000);
  }

  /**
   * Load user patterns from storage
   */
  private loadUserPatterns(): void {
    try {
      if (typeof window === 'undefined') return;

      const stored = localStorage.getItem('wewrite_user_patterns');
      if (stored) {
        const data = JSON.parse(stored);
        for (const [userId, patternData] of Object.entries(data)) {
          const pattern = patternData as any;
          this.userPatterns.set(userId, {
            ...pattern,
            frequentPages: new Map(pattern.frequentPages || []),
            frequentEndpoints: new Map(pattern.frequentEndpoints || [])
          });
        }
        console.log(`🧠 [IntelligentWarming] Loaded patterns for ${this.userPatterns.size} users`);
      }
    } catch (error) {
      console.error('🧠 [IntelligentWarming] Error loading user patterns:', error);
    }
  }

  /**
   * Save user patterns to storage
   */
  private saveUserPatterns(): void {
    try {
      if (typeof window === 'undefined') return;

      const data: Record<string, any> = {};
      for (const [userId, pattern] of this.userPatterns.entries()) {
        data[userId] = {
          ...pattern,
          frequentPages: Array.from(pattern.frequentPages.entries()),
          frequentEndpoints: Array.from(pattern.frequentEndpoints.entries())
        };
      }

      localStorage.setItem('wewrite_user_patterns', JSON.stringify(data));
    } catch (error) {
      console.error('🧠 [IntelligentWarming] Error saving user patterns:', error);
    }
  }

  /**
   * Get warming statistics
   */
  getStats(): WarmingStats & { candidateCount: number; patternCount: number } {
    return {
      ...this.stats,
      candidateCount: this.warmingCandidates.length,
      patternCount: this.userPatterns.size
    };
  }

  /**
   * Reset all patterns (for testing/debugging)
   */
  resetPatterns(): void {
    this.userPatterns.clear();
    this.warmingCandidates = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('wewrite_user_patterns');
    }
    console.log('🧠 [IntelligentWarming] All patterns reset');
  }
}

// Singleton instance
export const intelligentCacheWarming = new IntelligentCacheWarmingManager();

// Convenience functions for tracking
export const trackPageAccess = (userId: string, pageId: string) => {
  intelligentCacheWarming.trackAccess(userId, 'page', pageId);
};

export const trackEndpointAccess = (userId: string, endpoint: string) => {
  intelligentCacheWarming.trackAccess(userId, 'endpoint', endpoint);
};

export const getIntelligentWarmingStats = () => {
  return intelligentCacheWarming.getStats();
};
