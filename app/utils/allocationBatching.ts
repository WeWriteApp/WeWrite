"use client";

import { AllocationRequest, AllocationResponse } from '../types/allocation';

/**
 * Enhanced allocation batching system
 * 
 * This system provides:
 * - Intelligent request batching and deduplication
 * - Adaptive batch timing based on user behavior
 * - Priority-based request handling
 * - Automatic retry with exponential backoff
 * - Request coalescing for the same page
 */

interface BatchedRequest {
  id: string;
  request: AllocationRequest;
  resolve: (response: AllocationResponse) => void;
  reject: (error: Error) => void;
  timestamp: number;
  priority: 'high' | 'normal' | 'low';
  retryCount: number;
}

interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  minWaitTime: number;
  adaptiveDelay: boolean;
  enableCoalescing: boolean;
  maxRetries: number;
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxBatchSize: 10,
  maxWaitTime: 500, // 500ms max wait
  minWaitTime: 50,  // 50ms min wait
  adaptiveDelay: true,
  enableCoalescing: true,
  maxRetries: 3
};

class AllocationBatcher {
  private pendingRequests = new Map<string, BatchedRequest>();
  private batchTimer: NodeJS.Timeout | null = null;
  private config: BatchConfig;
  private recentActivity: number[] = [];
  private isProcessing = false;

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  /**
   * Add a request to the batch queue
   */
  async batchRequest(
    request: AllocationRequest,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<AllocationResponse> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId(request);
      
      // Handle request coalescing for the same page
      if (this.config.enableCoalescing) {
        const existingRequest = this.findCoalescableRequest(request);
        if (existingRequest) {
          // Coalesce requests by combining the change amounts
          existingRequest.request.changeCents += request.changeCents;
          existingRequest.priority = this.getHigherPriority(existingRequest.priority, priority);
          
          // Return the existing promise (will resolve when batch processes)
          existingRequest.resolve = resolve;
          existingRequest.reject = reject;
          return;
        }
      }

      // Add new request to batch
      const batchedRequest: BatchedRequest = {
        id: requestId,
        request,
        resolve,
        reject,
        timestamp: Date.now(),
        priority,
        retryCount: 0
      };

      this.pendingRequests.set(requestId, batchedRequest);
      this.scheduleBatch();
    });
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(request: AllocationRequest): string {
    return `${request.pageId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Find a request that can be coalesced with the current request
   */
  private findCoalescableRequest(request: AllocationRequest): BatchedRequest | null {
    for (const [, batchedRequest] of this.pendingRequests) {
      if (
        batchedRequest.request.pageId === request.pageId &&
        batchedRequest.request.source === request.source &&
        Date.now() - batchedRequest.timestamp < 1000 // Within 1 second
      ) {
        return batchedRequest;
      }
    }
    return null;
  }

  /**
   * Get the higher priority between two priorities
   */
  private getHigherPriority(
    priority1: 'high' | 'normal' | 'low',
    priority2: 'high' | 'normal' | 'low'
  ): 'high' | 'normal' | 'low' {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    return priorityOrder[priority1] >= priorityOrder[priority2] ? priority1 : priority2;
  }

  /**
   * Schedule batch processing with adaptive timing
   */
  private scheduleBatch(): void {
    if (this.batchTimer) {
      return; // Already scheduled
    }

    const delay = this.calculateAdaptiveDelay();
    
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, delay);

    // Process immediately if batch is full or has high priority requests
    if (this.shouldProcessImmediately()) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
      this.processBatch();
    }
  }

  /**
   * Calculate adaptive delay based on recent activity
   */
  private calculateAdaptiveDelay(): number {
    if (!this.config.adaptiveDelay) {
      return this.config.maxWaitTime;
    }

    // Track recent activity
    const now = Date.now();
    this.recentActivity = this.recentActivity.filter(time => now - time < 5000); // Last 5 seconds
    this.recentActivity.push(now);

    // More activity = shorter delay
    const activityFactor = Math.min(this.recentActivity.length / 10, 1);
    const delay = this.config.maxWaitTime - (activityFactor * (this.config.maxWaitTime - this.config.minWaitTime));
    
    return Math.max(delay, this.config.minWaitTime);
  }

  /**
   * Check if batch should be processed immediately
   */
  private shouldProcessImmediately(): boolean {
    if (this.pendingRequests.size >= this.config.maxBatchSize) {
      return true;
    }

    // Check for high priority requests
    for (const [, request] of this.pendingRequests) {
      if (request.priority === 'high') {
        return true;
      }
    }

    return false;
  }

  /**
   * Process the current batch of requests
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.pendingRequests.size === 0) {
      return;
    }

    this.isProcessing = true;
    this.batchTimer = null;

    // Get current batch and clear pending requests
    const currentBatch = new Map(this.pendingRequests);
    this.pendingRequests.clear();

    // Sort by priority and timestamp
    const sortedRequests = Array.from(currentBatch.values()).sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.timestamp - b.timestamp;
    });

    // Process requests in batches
    const batchSize = Math.min(sortedRequests.length, this.config.maxBatchSize);
    const requestsToProcess = sortedRequests.slice(0, batchSize);
    const remainingRequests = sortedRequests.slice(batchSize);

    // Re-queue remaining requests
    remainingRequests.forEach(request => {
      this.pendingRequests.set(request.id, request);
    });

    try {
      await this.executeBatch(requestsToProcess);
    } catch (error) {
      console.error('Batch processing error:', error);
    }

    this.isProcessing = false;

    // Schedule next batch if there are remaining requests
    if (this.pendingRequests.size > 0) {
      this.scheduleBatch();
    }
  }

  /**
   * Execute a batch of requests
   */
  private async executeBatch(requests: BatchedRequest[]): Promise<void> {
    // Group requests by page for potential server-side optimization
    const requestsByPage = new Map<string, BatchedRequest[]>();
    
    requests.forEach(request => {
      const pageId = request.request.pageId;
      if (!requestsByPage.has(pageId)) {
        requestsByPage.set(pageId, []);
      }
      requestsByPage.get(pageId)!.push(request);
    });

    // Process each page group
    const promises = Array.from(requestsByPage.entries()).map(([pageId, pageRequests]) =>
      this.executePageBatch(pageId, pageRequests)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Execute requests for a specific page
   */
  private async executePageBatch(pageId: string, requests: BatchedRequest[]): Promise<void> {
    // For now, process requests individually
    // In the future, this could be optimized with a batch API endpoint
    const promises = requests.map(request => this.executeRequest(request));
    await Promise.allSettled(promises);
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest(batchedRequest: BatchedRequest): Promise<void> {
    try {
      // Transform the request to match API expectations
      const apiRequest = {
        pageId: batchedRequest.request.pageId,
        usdCentsChange: batchedRequest.request.changeCents
      };

      const response = await fetch('/api/usd/allocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: AllocationResponse = await response.json();
      batchedRequest.resolve(data);
    } catch (error) {
      // Retry logic
      if (batchedRequest.retryCount < this.config.maxRetries) {
        batchedRequest.retryCount++;
        
        // Exponential backoff
        const delay = Math.pow(2, batchedRequest.retryCount) * 1000;
        
        setTimeout(() => {
          this.pendingRequests.set(batchedRequest.id, batchedRequest);
          this.scheduleBatch();
        }, delay);
      } else {
        batchedRequest.reject(error as Error);
      }
    }
  }

  /**
   * Clear all pending requests
   */
  clearPendingRequests(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Reject all pending requests
    for (const [, request] of this.pendingRequests) {
      request.reject(new Error('Request cancelled'));
    }

    this.pendingRequests.clear();
  }

  /**
   * Get current batch statistics
   */
  getBatchStats(): {
    pendingRequests: number;
    isProcessing: boolean;
    recentActivity: number;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      isProcessing: this.isProcessing,
      recentActivity: this.recentActivity.length
    };
  }
}

// Global batcher instance
export const allocationBatcher = new AllocationBatcher();

// Export for testing and advanced usage
export { AllocationBatcher, type BatchConfig, type BatchedRequest };
