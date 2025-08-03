/**
 * Background Processor - Defer Non-Critical Operations for Cost Optimization
 * 
 * Processes non-critical operations in the background to reduce real-time
 * Firebase read/write pressure and improve user experience.
 */

interface BackgroundTask {
  id: string;
  type: string;
  priority: number;
  data: any;
  retries: number;
  maxRetries: number;
  createdAt: number;
  scheduledFor: number;
  processor: (data: any) => Promise<any>;
}

interface ProcessorStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  averageProcessingTime: number;
  lastProcessedAt: number;
}

class BackgroundProcessor {
  private tasks = new Map<string, BackgroundTask>();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private stats: ProcessorStats = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    pendingTasks: 0,
    averageProcessingTime: 0,
    lastProcessedAt: 0
  };

  // Configuration
  private readonly PROCESSING_INTERVAL = 30000; // Process every 30 seconds
  private readonly MAX_CONCURRENT_TASKS = 3; // Limit concurrent processing
  private readonly DEFAULT_MAX_RETRIES = 3;
  private readonly TASK_TIMEOUT = 60000; // 1 minute timeout per task

  constructor() {
    this.startProcessor();
    this.setupCleanup();
  }

  /**
   * Add a task to the background processing queue
   */
  addTask(
    id: string,
    type: string,
    processor: (data: any) => Promise<any>,
    data: any,
    options: {
      priority?: number;
      delay?: number;
      maxRetries?: number;
    } = {}
  ): void {
    const {
      priority = 1,
      delay = 0,
      maxRetries = this.DEFAULT_MAX_RETRIES
    } = options;

    const task: BackgroundTask = {
      id,
      type,
      priority,
      data,
      retries: 0,
      maxRetries,
      createdAt: Date.now(),
      scheduledFor: Date.now() + delay,
      processor
    };

    this.tasks.set(id, task);
    this.stats.totalTasks++;
    this.stats.pendingTasks++;

    console.log(`🔄 [BackgroundProcessor] Added task: ${id} (type: ${type}, priority: ${priority})`);
  }

  /**
   * Remove a task from the queue
   */
  removeTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.delete(id);
      this.stats.pendingTasks--;
      console.log(`🔄 [BackgroundProcessor] Removed task: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Start the background processor
   */
  private startProcessor(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, this.PROCESSING_INTERVAL);

    console.log('🔄 [BackgroundProcessor] Started background processor');
  }

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.tasks.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get tasks ready for processing, sorted by priority and schedule time
      const readyTasks = Array.from(this.tasks.values())
        .filter(task => task.scheduledFor <= Date.now())
        .sort((a, b) => {
          // Sort by priority first, then by scheduled time
          if (a.priority !== b.priority) {
            return b.priority - a.priority; // Higher priority first
          }
          return a.scheduledFor - b.scheduledFor; // Earlier scheduled first
        })
        .slice(0, this.MAX_CONCURRENT_TASKS);

      if (readyTasks.length === 0) {
        return;
      }

      console.log(`🔄 [BackgroundProcessor] Processing ${readyTasks.length} tasks`);

      // Process tasks concurrently
      const processingPromises = readyTasks.map(task => this.processTask(task));
      await Promise.allSettled(processingPromises);

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single task
   */
  private async processTask(task: BackgroundTask): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`🔄 [BackgroundProcessor] Processing task: ${task.id} (attempt ${task.retries + 1})`);

      // Set timeout for task processing
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.TASK_TIMEOUT);
      });

      // Race between task processing and timeout
      await Promise.race([
        task.processor(task.data),
        timeoutPromise
      ]);

      // Task completed successfully
      this.tasks.delete(task.id);
      this.stats.completedTasks++;
      this.stats.pendingTasks--;

      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      console.log(`🔄 [BackgroundProcessor] Completed task: ${task.id} (${processingTime}ms)`);

    } catch (error) {
      console.error(`🔄 [BackgroundProcessor] Task failed: ${task.id}`, error);

      task.retries++;

      if (task.retries >= task.maxRetries) {
        // Max retries reached, remove task
        this.tasks.delete(task.id);
        this.stats.failedTasks++;
        this.stats.pendingTasks--;
        console.error(`🔄 [BackgroundProcessor] Task failed permanently: ${task.id}`);
      } else {
        // Schedule retry with exponential backoff
        const backoffDelay = Math.pow(2, task.retries) * 1000; // 2s, 4s, 8s...
        task.scheduledFor = Date.now() + backoffDelay;
        console.log(`🔄 [BackgroundProcessor] Retrying task: ${task.id} in ${backoffDelay}ms`);
      }
    }

    this.stats.lastProcessedAt = Date.now();
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(newTime: number): void {
    if (this.stats.completedTasks === 1) {
      this.stats.averageProcessingTime = newTime;
    } else {
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (this.stats.completedTasks - 1) + newTime) / this.stats.completedTasks;
    }
  }

  /**
   * Setup cleanup for old completed tasks
   */
  private setupCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const oldTaskThreshold = 24 * 60 * 60 * 1000; // 24 hours

      let removedCount = 0;
      for (const [id, task] of this.tasks.entries()) {
        if (now - task.createdAt > oldTaskThreshold) {
          this.tasks.delete(id);
          this.stats.pendingTasks--;
          removedCount++;
        }
      }

      if (removedCount > 0) {
        console.log(`🔄 [BackgroundProcessor] Cleaned up ${removedCount} old tasks`);
      }
    }, 60 * 60 * 1000); // Run cleanup every hour
  }

  /**
   * Get processor statistics
   */
  getStats(): ProcessorStats {
    return { ...this.stats };
  }

  /**
   * Stop the background processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log('🔄 [BackgroundProcessor] Stopped background processor');
  }
}

// Global background processor instance
const backgroundProcessor = new BackgroundProcessor();

/**
 * Convenience functions for common background tasks
 */

// Analytics processing
export const processAnalyticsInBackground = (data: any) => {
  backgroundProcessor.addTask(
    `analytics-${Date.now()}`,
    'analytics',
    async (data) => {
      // Process analytics data without blocking UI
      await fetch('/api/analytics/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    data,
    { priority: 1, delay: 5000 } // Low priority, 5 second delay
  );
};

// Cache warming
export const warmCacheInBackground = (cacheKey: string, fetcher: () => Promise<any>) => {
  backgroundProcessor.addTask(
    `cache-warm-${cacheKey}`,
    'cache-warming',
    fetcher,
    { cacheKey },
    { priority: 2, delay: 2000 } // Medium priority, 2 second delay
  );
};

// Data synchronization
export const syncDataInBackground = (syncData: any) => {
  backgroundProcessor.addTask(
    `sync-${Date.now()}`,
    'data-sync',
    async (data) => {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    syncData,
    { priority: 3, delay: 1000 } // High priority, 1 second delay
  );
};

// Export the processor and utility functions
export { backgroundProcessor };
export const addBackgroundTask = (id: string, type: string, processor: (data: any) => Promise<any>, data: any, options?: any) =>
  backgroundProcessor.addTask(id, type, processor, data, options);
export const removeBackgroundTask = (id: string) => backgroundProcessor.removeTask(id);
export const getBackgroundStats = () => backgroundProcessor.getStats();
