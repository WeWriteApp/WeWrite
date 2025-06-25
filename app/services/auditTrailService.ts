/**
 * Comprehensive Audit Trail Service
 * 
 * Immutable audit logs for all financial operations with compliance reporting,
 * data retention policies, and regulatory access controls.
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

import {
  FinancialOperationResult,
  FinancialError,
  FinancialErrorCode,
  FinancialUtils,
  FinancialLogger,
  CorrelationId
} from '../types/financial';

/**
 * Audit event types
 */
export enum AuditEventType {
  // Financial Operations
  TOKEN_ALLOCATION = 'token_allocation',
  PAYOUT_REQUEST = 'payout_request',
  PAYOUT_PROCESSED = 'payout_processed',
  BALANCE_UPDATE = 'balance_update',
  TRANSACTION_CREATED = 'transaction_created',
  TRANSACTION_UPDATED = 'transaction_updated',
  
  // User Management
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_SUSPENDED = 'user_suspended',
  USER_REACTIVATED = 'user_reactivated',
  
  // Security Events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_CHANGED = 'password_changed',
  FRAUD_DETECTED = 'fraud_detected',
  ACCOUNT_LOCKED = 'account_locked',
  
  // Administrative Actions
  ADMIN_ACCESS = 'admin_access',
  CONFIG_CHANGED = 'config_changed',
  FEATURE_TOGGLED = 'feature_toggled',
  DATA_EXPORT = 'data_export',
  
  // Compliance Events
  TAX_DOCUMENT_GENERATED = 'tax_document_generated',
  COMPLIANCE_CHECK = 'compliance_check',
  REGULATORY_REPORT = 'regulatory_report',
  DATA_RETENTION = 'data_retention',
  
  // System Events
  SYSTEM_ERROR = 'system_error',
  BACKUP_CREATED = 'backup_created',
  MAINTENANCE_START = 'maintenance_start',
  MAINTENANCE_END = 'maintenance_end'
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Audit event record
 */
export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  
  // Event details
  description: string;
  entityType?: string;
  entityId?: string;
  
  // Before/after state for changes
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  
  // Context and metadata
  correlationId: CorrelationId;
  metadata: Record<string, any>;
  
  // Compliance fields
  regulatoryCategory?: string;
  retentionPeriod?: number; // days
  
  // Immutability verification
  hash: string;
  previousHash?: string;
}

/**
 * Audit query filters
 */
export interface AuditQueryFilters {
  eventTypes?: AuditEventType[];
  severity?: AuditSeverity[];
  userId?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  correlationId?: string;
  regulatoryCategory?: string;
}

/**
 * Audit report configuration
 */
export interface AuditReportConfig {
  title: string;
  description: string;
  filters: AuditQueryFilters;
  includeMetadata: boolean;
  includeStateChanges: boolean;
  format: 'json' | 'csv' | 'pdf';
  retentionDays: number;
}

/**
 * Data retention policy
 */
export interface RetentionPolicy {
  eventType: AuditEventType;
  retentionDays: number;
  archiveAfterDays?: number;
  deleteAfterDays?: number;
  regulatoryRequirement?: string;
}

const DEFAULT_RETENTION_POLICIES: RetentionPolicy[] = [
  // Financial records - 7 years (IRS requirement)
  { eventType: AuditEventType.TOKEN_ALLOCATION, retentionDays: 2555, regulatoryRequirement: 'IRS' },
  { eventType: AuditEventType.PAYOUT_REQUEST, retentionDays: 2555, regulatoryRequirement: 'IRS' },
  { eventType: AuditEventType.PAYOUT_PROCESSED, retentionDays: 2555, regulatoryRequirement: 'IRS' },
  { eventType: AuditEventType.TAX_DOCUMENT_GENERATED, retentionDays: 2555, regulatoryRequirement: 'IRS' },
  
  // Security events - 3 years
  { eventType: AuditEventType.LOGIN_SUCCESS, retentionDays: 1095 },
  { eventType: AuditEventType.LOGIN_FAILED, retentionDays: 1095 },
  { eventType: AuditEventType.FRAUD_DETECTED, retentionDays: 1095 },
  
  // Administrative actions - 5 years
  { eventType: AuditEventType.ADMIN_ACCESS, retentionDays: 1825 },
  { eventType: AuditEventType.CONFIG_CHANGED, retentionDays: 1825 },
  { eventType: AuditEventType.DATA_EXPORT, retentionDays: 1825 },
  
  // System events - 1 year
  { eventType: AuditEventType.SYSTEM_ERROR, retentionDays: 365 },
  { eventType: AuditEventType.BACKUP_CREATED, retentionDays: 365 }
];

export class AuditTrailService {
  private static instance: AuditTrailService;
  private retentionPolicies: Map<AuditEventType, RetentionPolicy> = new Map();
  private lastHash: string = '';

  private constructor() {
    this.initializeRetentionPolicies();
  }

  static getInstance(): AuditTrailService {
    if (!AuditTrailService.instance) {
      AuditTrailService.instance = new AuditTrailService();
    }
    return AuditTrailService.instance;
  }

  /**
   * Log an audit event
   */
  async logEvent(
    eventType: AuditEventType,
    description: string,
    options: {
      severity?: AuditSeverity;
      userId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
      entityType?: string;
      entityId?: string;
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
      metadata?: Record<string, any>;
      regulatoryCategory?: string;
      correlationId?: CorrelationId;
    } = {}
  ): Promise<FinancialOperationResult<AuditEvent>> {
    const corrId = options.correlationId || FinancialUtils.generateCorrelationId();

    try {
      const eventId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date();
      
      // Get retention policy for this event type
      const retentionPolicy = this.retentionPolicies.get(eventType);
      const retentionPeriod = retentionPolicy?.retentionDays || 365;

      // Create audit event
      const auditEvent: AuditEvent = {
        id: eventId,
        eventType,
        severity: options.severity || AuditSeverity.INFO,
        timestamp,
        userId: options.userId,
        sessionId: options.sessionId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        description,
        entityType: options.entityType,
        entityId: options.entityId,
        beforeState: options.beforeState,
        afterState: options.afterState,
        correlationId: corrId,
        metadata: options.metadata || {},
        regulatoryCategory: options.regulatoryCategory,
        retentionPeriod,
        hash: '',
        previousHash: this.lastHash
      };

      // Calculate hash for immutability
      auditEvent.hash = this.calculateEventHash(auditEvent);
      this.lastHash = auditEvent.hash;

      // Store in Firestore
      await setDoc(doc(db, 'auditTrail', eventId), {
        ...auditEvent,
        timestamp: serverTimestamp()
      });

      // Log to console for immediate visibility
      console.log(`[AUDIT] ${eventType.toUpperCase()}`, {
        eventId,
        description,
        userId: options.userId,
        correlationId: corrId,
        severity: auditEvent.severity
      });

      return {
        success: true,
        data: auditEvent,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.PROCESSING_ERROR,
        `Failed to log audit event: ${error.message}`,
        true,
        { correlationId: corrId, eventType, originalError: error }
      );

      // Even if audit logging fails, we should log to console
      console.error('[AUDIT] LOGGING_FAILED', {
        eventType,
        description,
        error: error.message,
        correlationId: corrId
      });

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Query audit events with filters
   */
  async queryEvents(
    filters: AuditQueryFilters,
    limitCount: number = 100,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<AuditEvent[]>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      let auditQuery = collection(db, 'auditTrail');
      const constraints: any[] = [];

      // Apply filters
      if (filters.eventTypes && filters.eventTypes.length > 0) {
        constraints.push(where('eventType', 'in', filters.eventTypes));
      }

      if (filters.severity && filters.severity.length > 0) {
        constraints.push(where('severity', 'in', filters.severity));
      }

      if (filters.userId) {
        constraints.push(where('userId', '==', filters.userId));
      }

      if (filters.entityType) {
        constraints.push(where('entityType', '==', filters.entityType));
      }

      if (filters.entityId) {
        constraints.push(where('entityId', '==', filters.entityId));
      }

      if (filters.correlationId) {
        constraints.push(where('correlationId', '==', filters.correlationId));
      }

      if (filters.regulatoryCategory) {
        constraints.push(where('regulatoryCategory', '==', filters.regulatoryCategory));
      }

      if (filters.startDate) {
        constraints.push(where('timestamp', '>=', filters.startDate));
      }

      if (filters.endDate) {
        constraints.push(where('timestamp', '<=', filters.endDate));
      }

      // Add ordering and limit
      constraints.push(orderBy('timestamp', 'desc'));
      constraints.push(limit(limitCount));

      const finalQuery = query(auditQuery, ...constraints);
      const querySnapshot = await getDocs(finalQuery);

      const events = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditEvent));

      return {
        success: true,
        data: events,
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.PROCESSING_ERROR,
        `Failed to query audit events: ${error.message}`,
        true,
        { correlationId: corrId, filters, originalError: error }
      );

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    config: AuditReportConfig,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{
    reportId: string;
    eventCount: number;
    reportUrl?: string;
  }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      // Query events based on filters
      const eventsResult = await this.queryEvents(config.filters, 10000, corrId);

      if (!eventsResult.success) {
        return {
          success: false,
          error: eventsResult.error,
          correlationId: corrId
        };
      }

      const events = eventsResult.data!;
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create report metadata
      const reportMetadata = {
        id: reportId,
        title: config.title,
        description: config.description,
        generatedAt: new Date(),
        generatedBy: 'system', // Would be actual user in production
        eventCount: events.length,
        filters: config.filters,
        format: config.format,
        retentionDays: config.retentionDays,
        correlationId: corrId
      };

      // Store report metadata
      await setDoc(doc(db, 'auditReports', reportId), {
        ...reportMetadata,
        generatedAt: serverTimestamp()
      });

      // Log report generation
      await this.logEvent(
        AuditEventType.REGULATORY_REPORT,
        `Compliance report generated: ${config.title}`,
        {
          severity: AuditSeverity.INFO,
          entityType: 'audit_report',
          entityId: reportId,
          metadata: {
            eventCount: events.length,
            format: config.format,
            filters: config.filters
          },
          regulatoryCategory: 'compliance_reporting',
          correlationId: corrId
        }
      );

      return {
        success: true,
        data: {
          reportId,
          eventCount: events.length,
          reportUrl: `/api/audit/reports/${reportId}`
        },
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.PROCESSING_ERROR,
        `Failed to generate compliance report: ${error.message}`,
        true,
        { correlationId: corrId, config, originalError: error }
      );

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  /**
   * Verify audit trail integrity
   */
  async verifyIntegrity(
    startDate?: Date,
    endDate?: Date,
    correlationId?: CorrelationId
  ): Promise<FinancialOperationResult<{
    totalEvents: number;
    verifiedEvents: number;
    corruptedEvents: number;
    integrityScore: number;
  }>> {
    const corrId = correlationId || FinancialUtils.generateCorrelationId();

    try {
      const filters: AuditQueryFilters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const eventsResult = await this.queryEvents(filters, 10000, corrId);

      if (!eventsResult.success) {
        return {
          success: false,
          error: eventsResult.error,
          correlationId: corrId
        };
      }

      const events = eventsResult.data!;
      let verifiedEvents = 0;
      let corruptedEvents = 0;

      // Verify hash chain integrity
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const calculatedHash = this.calculateEventHash(event);

        if (calculatedHash === event.hash) {
          verifiedEvents++;
        } else {
          corruptedEvents++;

          // Log integrity violation
          await this.logEvent(
            AuditEventType.SYSTEM_ERROR,
            `Audit trail integrity violation detected`,
            {
              severity: AuditSeverity.CRITICAL,
              entityType: 'audit_event',
              entityId: event.id,
              metadata: {
                expectedHash: calculatedHash,
                actualHash: event.hash,
                eventType: event.eventType
              },
              regulatoryCategory: 'data_integrity',
              correlationId: corrId
            }
          );
        }
      }

      const integrityScore = events.length > 0 ? (verifiedEvents / events.length) * 100 : 100;

      return {
        success: true,
        data: {
          totalEvents: events.length,
          verifiedEvents,
          corruptedEvents,
          integrityScore
        },
        correlationId: corrId
      };

    } catch (error: any) {
      const financialError = new FinancialError(
        FinancialErrorCode.PROCESSING_ERROR,
        `Failed to verify audit trail integrity: ${error.message}`,
        true,
        { correlationId: corrId, originalError: error }
      );

      return {
        success: false,
        error: financialError,
        correlationId: corrId
      };
    }
  }

  // Helper methods

  /**
   * Calculate hash for audit event immutability
   */
  private calculateEventHash(event: AuditEvent): string {
    // Create a deterministic string representation
    const hashData = {
      eventType: event.eventType,
      timestamp: event.timestamp.toISOString(),
      userId: event.userId || '',
      description: event.description,
      entityType: event.entityType || '',
      entityId: event.entityId || '',
      beforeState: event.beforeState || {},
      afterState: event.afterState || {},
      correlationId: event.correlationId,
      previousHash: event.previousHash || ''
    };

    const dataString = JSON.stringify(hashData, Object.keys(hashData).sort());

    // Simple hash function (in production, use a proper crypto hash like SHA-256)
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Initialize retention policies
   */
  private initializeRetentionPolicies(): void {
    DEFAULT_RETENTION_POLICIES.forEach(policy => {
      this.retentionPolicies.set(policy.eventType, policy);
    });
  }

  /**
   * Execute retention actions (archive/delete)
   */
  private async executeRetentionActions(
    actions: Array<{ eventId: string; action: 'archive' | 'delete'; reason: string }>,
    correlationId: CorrelationId
  ): Promise<void> {
    const batch = writeBatch(db);

    for (const action of actions) {
      if (action.action === 'delete') {
        // In production, this would move to archive storage first
        batch.update(doc(db, 'auditTrail', action.eventId), {
          deleted: true,
          deletedAt: serverTimestamp(),
          deletionReason: action.reason
        });
      } else if (action.action === 'archive') {
        batch.update(doc(db, 'auditTrail', action.eventId), {
          archived: true,
          archivedAt: serverTimestamp(),
          archiveReason: action.reason
        });
      }
    }

    await batch.commit();
  }

  /**
   * Generate JSON report format
   */
  private generateJsonReport(events: AuditEvent[], config: AuditReportConfig): any {
    return {
      metadata: {
        title: config.title,
        description: config.description,
        generatedAt: new Date().toISOString(),
        eventCount: events.length,
        filters: config.filters
      },
      events: events.map(event => ({
        id: event.id,
        eventType: event.eventType,
        severity: event.severity,
        timestamp: event.timestamp,
        userId: event.userId,
        description: event.description,
        entityType: event.entityType,
        entityId: event.entityId,
        ...(config.includeStateChanges && {
          beforeState: event.beforeState,
          afterState: event.afterState
        }),
        ...(config.includeMetadata && {
          metadata: event.metadata
        }),
        correlationId: event.correlationId
      }))
    };
  }

  /**
   * Generate CSV report format
   */
  private generateCsvReport(events: AuditEvent[], config: AuditReportConfig): string {
    const headers = [
      'ID',
      'Event Type',
      'Severity',
      'Timestamp',
      'User ID',
      'Description',
      'Entity Type',
      'Entity ID',
      'Correlation ID'
    ];

    if (config.includeStateChanges) {
      headers.push('Before State', 'After State');
    }

    if (config.includeMetadata) {
      headers.push('Metadata');
    }

    const csvRows = [headers.join(',')];

    events.forEach(event => {
      const row = [
        event.id,
        event.eventType,
        event.severity,
        event.timestamp.toISOString(),
        event.userId || '',
        `"${event.description.replace(/"/g, '""')}"`,
        event.entityType || '',
        event.entityId || '',
        event.correlationId
      ];

      if (config.includeStateChanges) {
        row.push(
          JSON.stringify(event.beforeState || {}),
          JSON.stringify(event.afterState || {})
        );
      }

      if (config.includeMetadata) {
        row.push(JSON.stringify(event.metadata || {}));
      }

      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Generate PDF report format (placeholder)
   */
  private generatePdfReport(events: AuditEvent[], config: AuditReportConfig): any {
    // In production, this would use a PDF generation library
    return {
      format: 'pdf',
      title: config.title,
      eventCount: events.length,
      note: 'PDF generation would be implemented with a proper PDF library'
    };
  }

  /**
   * Get retention policy for event type
   */
  getRetentionPolicy(eventType: AuditEventType): RetentionPolicy | undefined {
    return this.retentionPolicies.get(eventType);
  }

  /**
   * Update retention policy
   */
  updateRetentionPolicy(policy: RetentionPolicy): void {
    this.retentionPolicies.set(policy.eventType, policy);
  }

  /**
   * Get all retention policies
   */
  getAllRetentionPolicies(): RetentionPolicy[] {
    return Array.from(this.retentionPolicies.values());
  }
}
