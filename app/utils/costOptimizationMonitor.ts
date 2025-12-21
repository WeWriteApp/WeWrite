/**
 * Cost Optimization Monitor - Backwards compatibility wrapper
 *
 * This module now delegates to the main costMonitor for simplicity.
 * The separate optimization monitor has been deprecated.
 *
 * @deprecated Use trackFirebaseRead from costMonitor.ts directly
 */

import { trackFirebaseRead } from './costMonitor';

/**
 * Track a query operation
 * @deprecated Use trackFirebaseRead from costMonitor.ts
 */
export function trackQuery(
  operation: string,
  documentsRead: number,
  _queryTime: number,
  _hasDateFilter: boolean
): void {
  trackFirebaseRead('pages', operation, documentsRead, 'query');
}

/**
 * Track a batch operation
 * @deprecated Use trackFirebaseRead from costMonitor.ts
 */
export function trackBatch(
  type: 'visitor' | 'pageView',
  batchSize: number,
  _processingTime: number,
  _success: boolean
): void {
  trackFirebaseRead(type === 'visitor' ? 'visitors' : 'pageViews', 'batch_write', batchSize, 'batch');
}

/**
 * Track an immediate write
 * @deprecated Use trackFirebaseRead from costMonitor.ts
 */
export function trackImmediateWrite(operation: string): void {
  trackFirebaseRead('pages', operation, 1, 'immediate_write');
}

/**
 * Get optimization report
 * @deprecated Use getCostStats from costMonitor.ts
 */
export function getOptimizationReport() {
  return {
    summary: 'Cost optimization monitoring delegated to costMonitor',
    metrics: {},
    recommendations: []
  };
}

// For backwards compatibility - export a dummy monitor instance
export const costOptimizationMonitor = {
  trackQuery,
  trackBatch,
  trackImmediateWrite,
  getOptimizationReport
};
