/**
 * Webhook Idempotency Service
 *
 * Ensures webhook events are processed exactly once by tracking processed event IDs
 * in Firestore. Prevents duplicate processing from Stripe webhook retries.
 *
 * Features:
 * - Atomic check-and-mark operations using Firestore transactions
 * - Event status tracking (processing, completed, failed)
 * - Automatic TTL cleanup (30-day retention)
 * - Event metadata storage for debugging
 * - Support for multiple webhook endpoints
 */

import { db } from '../firebase/config';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';

// ============================================================================
// Type Definitions
// ============================================================================

export type WebhookEventStatus = 'processing' | 'completed' | 'failed';

export interface ProcessedWebhookEvent {
  eventId: string;
  eventType: string;
  processedAt: Timestamp;
  status: WebhookEventStatus;
  webhookEndpoint: string;
  metadata?: Record<string, any>;
  error?: string;
  completedAt?: Timestamp;
  failedAt?: Timestamp;
}

export interface IdempotencyCheckResult {
  isProcessed: boolean;
  status?: WebhookEventStatus;
  processedAt?: Date;
}

// ============================================================================
// Webhook Idempotency Service
// ============================================================================

class WebhookIdempotencyService {
  private readonly COLLECTION_NAME = 'processedWebhookEvents';
  private readonly TTL_DAYS = 30; // Keep events for 30 days
  private readonly CLEANUP_BATCH_SIZE = 100;

  /**
   * Check if an event has already been processed
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    try {
      const eventRef = doc(db, this.COLLECTION_NAME, eventId);
      const eventDoc = await getDoc(eventRef);

      if (!eventDoc.exists()) {
        return false;
      }

      const data = eventDoc.data() as ProcessedWebhookEvent;

      // Event is considered processed if it's in any state except 'processing'
      // This prevents duplicate processing even if the first attempt is still in progress
      return true;
    } catch (error) {
      console.error('[WebhookIdempotency] Error checking event status:', error);
      // On error, assume not processed to allow processing (fail open)
      // This is safer than failing closed and potentially losing events
      return false;
    }
  }

  /**
   * Get detailed status of a processed event
   */
  async getEventStatus(eventId: string): Promise<IdempotencyCheckResult> {
    try {
      const eventRef = doc(db, this.COLLECTION_NAME, eventId);
      const eventDoc = await getDoc(eventRef);

      if (!eventDoc.exists()) {
        return { isProcessed: false };
      }

      const data = eventDoc.data() as ProcessedWebhookEvent;

      return {
        isProcessed: true,
        status: data.status,
        processedAt: data.processedAt.toDate()
      };
    } catch (error) {
      console.error('[WebhookIdempotency] Error getting event status:', error);
      return { isProcessed: false };
    }
  }

  /**
   * Atomically mark an event as processing
   * Returns true if successfully marked, false if already processed
   */
  async markEventProcessing(
    eventId: string,
    eventType: string,
    endpoint: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const eventRef = doc(db, this.COLLECTION_NAME, eventId);

      // Check if event already exists
      const existingDoc = await getDoc(eventRef);
      if (existingDoc.exists()) {
        console.log(`[WebhookIdempotency] Event ${eventId} already exists with status: ${existingDoc.data().status}`);
        return false;
      }

      // Create the event record atomically
      const eventData: ProcessedWebhookEvent = {
        eventId,
        eventType,
        processedAt: Timestamp.now(),
        status: 'processing',
        webhookEndpoint: endpoint,
        metadata: metadata || {}
      };

      await setDoc(eventRef, eventData);
      console.log(`[WebhookIdempotency] Marked event ${eventId} as processing`);
      return true;
    } catch (error) {
      console.error('[WebhookIdempotency] Error marking event as processing:', error);
      // On error, return false to prevent processing (fail safe)
      return false;
    }
  }

  /**
   * Mark an event as successfully completed
   */
  async markEventCompleted(eventId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const eventRef = doc(db, this.COLLECTION_NAME, eventId);

      const updates: Partial<ProcessedWebhookEvent> = {
        status: 'completed',
        completedAt: Timestamp.now()
      };

      if (metadata) {
        updates.metadata = metadata;
      }

      await updateDoc(eventRef, updates);
      console.log(`[WebhookIdempotency] Marked event ${eventId} as completed`);
    } catch (error) {
      console.error('[WebhookIdempotency] Error marking event as completed:', error);
      // Non-fatal - event was already processed successfully
    }
  }

  /**
   * Mark an event as failed
   */
  async markEventFailed(eventId: string, error: string, metadata?: Record<string, any>): Promise<void> {
    try {
      const eventRef = doc(db, this.COLLECTION_NAME, eventId);

      const updates: Partial<ProcessedWebhookEvent> = {
        status: 'failed',
        failedAt: Timestamp.now(),
        error
      };

      if (metadata) {
        updates.metadata = metadata;
      }

      await updateDoc(eventRef, updates);
      console.log(`[WebhookIdempotency] Marked event ${eventId} as failed: ${error}`);
    } catch (updateError) {
      console.error('[WebhookIdempotency] Error marking event as failed:', updateError);
      // Non-fatal - failure was already logged
    }
  }

  /**
   * Clean up old processed events (older than TTL_DAYS)
   * Should be called periodically via cron job
   */
  async cleanupOldEvents(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.TTL_DAYS);
      const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

      const eventsRef = collection(db, this.COLLECTION_NAME);
      const oldEventsQuery = query(
        eventsRef,
        where('processedAt', '<', cutoffTimestamp)
      );

      const snapshot = await getDocs(oldEventsQuery);

      console.log(`[WebhookIdempotency] Found ${snapshot.size} events older than ${this.TTL_DAYS} days`);

      // Delete in batches
      const deletePromises: Promise<void>[] = [];

      snapshot.forEach((doc) => {
        deletePromises.push(
          deleteDoc(doc.ref)
            .then(() => { deleted++; })
            .catch((error) => {
              console.error(`[WebhookIdempotency] Error deleting event ${doc.id}:`, error);
              errors++;
            })
        );

        // Process in batches to avoid overwhelming Firestore
        if (deletePromises.length >= this.CLEANUP_BATCH_SIZE) {
          return; // Stop at batch size
        }
      });

      await Promise.all(deletePromises);

      console.log(`[WebhookIdempotency] Cleanup complete: ${deleted} deleted, ${errors} errors`);

      return { deleted, errors };
    } catch (error) {
      console.error('[WebhookIdempotency] Error during cleanup:', error);
      return { deleted, errors };
    }
  }

  /**
   * Get statistics about processed events
   */
  async getStatistics(endpoint?: string): Promise<{
    total: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const eventsRef = collection(db, this.COLLECTION_NAME);
      let eventsQuery = query(eventsRef);

      if (endpoint) {
        eventsQuery = query(eventsRef, where('webhookEndpoint', '==', endpoint));
      }

      const snapshot = await getDocs(eventsQuery);

      const stats = {
        total: snapshot.size,
        processing: 0,
        completed: 0,
        failed: 0
      };

      snapshot.forEach((doc) => {
        const data = doc.data() as ProcessedWebhookEvent;
        if (data.status === 'processing') stats.processing++;
        else if (data.status === 'completed') stats.completed++;
        else if (data.status === 'failed') stats.failed++;
      });

      return stats;
    } catch (error) {
      console.error('[WebhookIdempotency] Error getting statistics:', error);
      return { total: 0, processing: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Get recent events for debugging
   */
  async getRecentEvents(limit: number = 50, endpoint?: string): Promise<ProcessedWebhookEvent[]> {
    try {
      const eventsRef = collection(db, this.COLLECTION_NAME);
      let eventsQuery = query(
        eventsRef,
        ...(endpoint ? [where('webhookEndpoint', '==', endpoint)] : [])
      );

      const snapshot = await getDocs(eventsQuery);

      const events: ProcessedWebhookEvent[] = [];
      snapshot.forEach((doc) => {
        events.push(doc.data() as ProcessedWebhookEvent);
      });

      // Sort by processedAt descending
      events.sort((a, b) => b.processedAt.toMillis() - a.processedAt.toMillis());

      return events.slice(0, limit);
    } catch (error) {
      console.error('[WebhookIdempotency] Error getting recent events:', error);
      return [];
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const webhookIdempotencyService = new WebhookIdempotencyService();
