import { AllocationBatcher, allocationBatcher } from '../allocationBatching';
import { AllocationRequest, AllocationResponse } from '../../types/allocation';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('AllocationBatcher', () => {
  let batcher: AllocationBatcher;

  beforeEach(() => {
    batcher = new AllocationBatcher({
      maxBatchSize: 5,
      maxWaitTime: 100,
      minWaitTime: 10,
      adaptiveDelay: false,
      enableCoalescing: true,
      maxRetries: 2
    });
    jest.useFakeTimers();
    mockFetch.mockClear();
  });

  afterEach(() => {
    batcher.clearPendingRequests();
    jest.useRealTimers();
  });

  describe('basic batching', () => {
    it('should batch requests with delay', async () => {
      const mockResponse: AllocationResponse = {
        success: true,
        currentAllocation: 100
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request: AllocationRequest = {
        pageId: 'test-page',
        changeCents: 50,
        source: 'FloatingBar'
      };

      const promise = batcher.batchRequest(request);

      // Should not execute immediately
      expect(mockFetch).not.toHaveBeenCalled();

      // Fast-forward time to trigger batch
      jest.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should process high priority requests immediately', async () => {
      const mockResponse: AllocationResponse = {
        success: true,
        currentAllocation: 100
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request: AllocationRequest = {
        pageId: 'test-page',
        changeCents: 50,
        source: 'FloatingBar'
      };

      const promise = batcher.batchRequest(request, 'high');

      // Should execute immediately for high priority
      await promise;
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should process when batch size limit is reached', async () => {
      const mockResponse: AllocationResponse = {
        success: true,
        currentAllocation: 100
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      // Add requests up to batch size limit
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const request: AllocationRequest = {
          pageId: `test-page-${i}`,
          changeCents: 50,
          source: 'FloatingBar'
        };
        promises.push(batcher.batchRequest(request));
      }

      // Should process immediately when batch is full
      await Promise.all(promises);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('request coalescing', () => {
    it('should coalesce requests for the same page', async () => {
      const mockResponse: AllocationResponse = {
        success: true,
        currentAllocation: 150
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request1: AllocationRequest = {
        pageId: 'test-page',
        changeCents: 50,
        source: 'FloatingBar'
      };

      const request2: AllocationRequest = {
        pageId: 'test-page',
        changeCents: 100,
        source: 'FloatingBar'
      };

      const promise1 = batcher.batchRequest(request1);
      const promise2 = batcher.batchRequest(request2);

      jest.advanceTimersByTime(100);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Should only make one request with combined amount
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/usd/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: 'test-page',
          changeCents: 150, // 50 + 100
          source: 'FloatingBar'
        })
      });

      expect(result1).toEqual(mockResponse);
      expect(result2).toEqual(mockResponse);
    });

    it('should not coalesce requests for different pages', async () => {
      const mockResponse: AllocationResponse = {
        success: true,
        currentAllocation: 100
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      const request1: AllocationRequest = {
        pageId: 'test-page-1',
        changeCents: 50,
        source: 'FloatingBar'
      };

      const request2: AllocationRequest = {
        pageId: 'test-page-2',
        changeCents: 100,
        source: 'FloatingBar'
      };

      const promise1 = batcher.batchRequest(request1);
      const promise2 = batcher.batchRequest(request2);

      jest.advanceTimersByTime(100);

      await Promise.all([promise1, promise2]);

      // Should make separate requests for different pages
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('priority handling', () => {
    it('should prioritize high priority requests', async () => {
      const mockResponse: AllocationResponse = {
        success: true,
        currentAllocation: 100
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);

      // Add low priority request first
      const lowPriorityPromise = batcher.batchRequest({
        pageId: 'low-priority',
        changeCents: 50,
        source: 'FloatingBar'
      }, 'low');

      // Add high priority request
      const highPriorityPromise = batcher.batchRequest({
        pageId: 'high-priority',
        changeCents: 100,
        source: 'FloatingBar'
      }, 'high');

      // High priority should process immediately
      await highPriorityPromise;
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Low priority should still be pending
      jest.advanceTimersByTime(100);
      await lowPriorityPromise;
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling and retries', () => {
    it('should retry failed requests', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, currentAllocation: 100 })
        } as Response);

      const request: AllocationRequest = {
        pageId: 'test-page',
        changeCents: 50,
        source: 'FloatingBar'
      };

      const promise = batcher.batchRequest(request);

      jest.advanceTimersByTime(100);

      // Wait for initial failure and retry
      jest.advanceTimersByTime(2000); // Exponential backoff delay

      const result = await promise;
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should give up after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent error'));

      const request: AllocationRequest = {
        pageId: 'test-page',
        changeCents: 50,
        source: 'FloatingBar'
      };

      const promise = batcher.batchRequest(request);

      jest.advanceTimersByTime(100);

      // Wait for all retries
      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(Math.pow(2, i + 1) * 1000);
      }

      await expect(promise).rejects.toThrow('Persistent error');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('adaptive delay', () => {
    it('should use adaptive delay based on activity', () => {
      const adaptiveBatcher = new AllocationBatcher({
        adaptiveDelay: true,
        maxWaitTime: 500,
        minWaitTime: 50
      });

      const stats = adaptiveBatcher.getBatchStats();
      expect(stats.pendingRequests).toBe(0);
      expect(stats.isProcessing).toBe(false);
      expect(stats.recentActivity).toBe(0);

      adaptiveBatcher.clearPendingRequests();
    });
  });

  describe('batch statistics', () => {
    it('should provide accurate batch statistics', () => {
      const request: AllocationRequest = {
        pageId: 'test-page',
        changeCents: 50,
        source: 'FloatingBar'
      };

      batcher.batchRequest(request);
      batcher.batchRequest(request);

      const stats = batcher.getBatchStats();
      expect(stats.pendingRequests).toBe(1); // Coalesced into one
      expect(stats.isProcessing).toBe(false);
    });
  });

  describe('global batcher instance', () => {
    it('should use the same instance across calls', () => {
      const request: AllocationRequest = {
        pageId: 'test-page',
        changeCents: 50,
        source: 'FloatingBar'
      };

      allocationBatcher.batchRequest(request);
      const stats = allocationBatcher.getBatchStats();
      expect(stats.pendingRequests).toBeGreaterThan(0);

      allocationBatcher.clearPendingRequests();
    });
  });
});
