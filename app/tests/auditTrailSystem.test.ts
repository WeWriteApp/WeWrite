/**
 * Comprehensive tests for Audit Trail System
 * 
 * Tests audit logging, compliance reporting, data retention,
 * and integrity verification capabilities.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AuditTrailService, AuditEventType, AuditSeverity } from '../services/auditTrailService';
import { FinancialUtils } from '../types/financial';

// Mock Firebase
jest.mock('../firebase/config', () => ({
  db: {}}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => new Date())}));

describe('Audit Trail System', () => {
  let auditService: AuditTrailService;
  let correlationId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    auditService = AuditTrailService.getInstance();
    correlationId = FinancialUtils.generateCorrelationId();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Audit Event Logging', () => {
    test('should log financial operation audit event', async () => {
      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await auditService.logEvent(
        AuditEventType.TOKEN_ALLOCATION,
        'User allocated 100 tokens to page',
        {
          severity: AuditSeverity.INFO,
          userId: 'user_123',
          sessionId: 'session_456',
          ipAddress: '192.168.1.1',
          entityType: 'page',
          entityId: 'page_789',
          beforeState: { tokens: 0 },
          afterState: { tokens: 100 },
          metadata: {
            pageTitle: 'Test Page',
            allocationAmount: 100
          },
          regulatoryCategory: 'financial_transaction',
          correlationId
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.eventType).toBe(AuditEventType.TOKEN_ALLOCATION);
      expect(result.data!.description).toBe('User allocated 100 tokens to page');
      expect(result.data!.userId).toBe('user_123');
      expect(result.data!.hash).toBeDefined();
      expect(setDoc).toHaveBeenCalled();
    });

    test('should log security event with proper severity', async () => {
      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await auditService.logEvent(
        AuditEventType.FRAUD_DETECTED,
        'Suspicious transaction pattern detected',
        {
          severity: AuditSeverity.CRITICAL,
          userId: 'user_suspicious',
          ipAddress: '10.0.0.1',
          entityType: 'transaction',
          entityId: 'txn_suspicious',
          metadata: {
            riskScore: 95,
            triggeredRules: ['velocity_check', 'pattern_analysis']
          },
          regulatoryCategory: 'security_incident',
          correlationId
        }
      );

      expect(result.success).toBe(true);
      expect(result.data!.severity).toBe(AuditSeverity.CRITICAL);
      expect(result.data!.regulatoryCategory).toBe('security_incident');
      expect(result.data!.metadata.riskScore).toBe(95);
    });

    test('should log administrative action', async () => {
      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await auditService.logEvent(
        AuditEventType.CONFIG_CHANGED,
        'Updated fraud detection threshold',
        {
          severity: AuditSeverity.WARNING,
          userId: 'admin_user',
          entityType: 'config',
          entityId: 'fraud_config',
          beforeState: { threshold: 50 },
          afterState: { threshold: 75 },
          metadata: {
            configSection: 'fraud_detection',
            changedBy: 'admin_user'
          },
          correlationId
        }
      );

      expect(result.success).toBe(true);
      expect(result.data!.beforeState).toEqual({ threshold: 50 });
      expect(result.data!.afterState).toEqual({ threshold: 75 });
    });

    test('should handle logging errors gracefully', async () => {
      const { setDoc } = require('firebase/firestore');
      setDoc.mockRejectedValue(new Error('Database connection failed'));

      const result = await auditService.logEvent(
        AuditEventType.SYSTEM_ERROR,
        'Test error logging',
        { correlationId }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('Failed to log audit event');
    });
  });

  describe('Audit Event Querying', () => {
    test('should query events by user ID', async () => {
      const mockEvents = [
        {
          id: 'event_1',
          eventType: AuditEventType.LOGIN_SUCCESS,
          userId: 'user_123',
          timestamp: new Date(),
          description: 'User logged in'
        },
        {
          id: 'event_2',
          eventType: AuditEventType.TOKEN_ALLOCATION,
          userId: 'user_123',
          timestamp: new Date(),
          description: 'User allocated tokens'
        }
      ];

      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockEvents.map(event => ({
          id: event.id,
          data: () => event
        }))
      });

      const result = await auditService.queryEvents(
        { userId: 'user_123' },
        50,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].userId).toBe('user_123');
      expect(result.data![1].userId).toBe('user_123');
    });

    test('should query events by event type and date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockEvents = [
        {
          id: 'event_1',
          eventType: AuditEventType.PAYOUT_PROCESSED,
          timestamp: new Date('2024-01-15'),
          description: 'Payout processed'
        }
      ];

      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockEvents.map(event => ({
          id: event.id,
          data: () => event
        }))
      });

      const result = await auditService.queryEvents(
        {
          eventTypes: [AuditEventType.PAYOUT_PROCESSED],
          startDate,
          endDate
        },
        100,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].eventType).toBe(AuditEventType.PAYOUT_PROCESSED);
    });

    test('should query events by severity level', async () => {
      const mockEvents = [
        {
          id: 'event_1',
          eventType: AuditEventType.FRAUD_DETECTED,
          severity: AuditSeverity.CRITICAL,
          description: 'Critical fraud detected'
        },
        {
          id: 'event_2',
          eventType: AuditEventType.SYSTEM_ERROR,
          severity: AuditSeverity.ERROR,
          description: 'System error occurred'
        }
      ];

      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockEvents.map(event => ({
          id: event.id,
          data: () => event
        }))
      });

      const result = await auditService.queryEvents(
        { severity: [AuditSeverity.CRITICAL, AuditSeverity.ERROR] },
        100,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data!.every(e => 
        e.severity === AuditSeverity.CRITICAL || e.severity === AuditSeverity.ERROR
      )).toBe(true);
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate compliance report', async () => {
      const mockEvents = [
        {
          id: 'event_1',
          eventType: AuditEventType.TAX_DOCUMENT_GENERATED,
          timestamp: new Date(),
          description: '1099 generated for user'
        },
        {
          id: 'event_2',
          eventType: AuditEventType.PAYOUT_PROCESSED,
          timestamp: new Date(),
          description: 'Payout processed'
        }
      ];

      const { getDocs, setDoc } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockEvents.map(event => ({
          id: event.id,
          data: () => event
        }))
      });
      setDoc.mockResolvedValue(undefined);

      // Mock the logEvent method to avoid recursive calls
      jest.spyOn(auditService, 'logEvent').mockResolvedValue({
        success: true,
        data: {} as any,
        correlationId
      });

      const reportConfig = {
        title: 'Financial Compliance Report',
        description: 'Report for regulatory compliance',
        filters: {
          eventTypes: [AuditEventType.TAX_DOCUMENT_GENERATED, AuditEventType.PAYOUT_PROCESSED],
          regulatoryCategory: 'financial_transaction'
        },
        includeMetadata: true,
        includeStateChanges: true,
        format: 'json' as const,
        retentionDays: 2555
      };

      const result = await auditService.generateComplianceReport(reportConfig, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.reportId).toBeDefined();
      expect(result.data!.eventCount).toBe(2);
      expect(result.data!.reportUrl).toBeDefined();
      expect(setDoc).toHaveBeenCalled();
    });

    test('should handle empty report generation', async () => {
      const { getDocs, setDoc } = require('firebase/firestore');
      getDocs.mockResolvedValue({ docs: [] });
      setDoc.mockResolvedValue(undefined);

      jest.spyOn(auditService, 'logEvent').mockResolvedValue({
        success: true,
        data: {} as any,
        correlationId
      });

      const reportConfig = {
        title: 'Empty Report',
        description: 'Report with no matching events',
        filters: { eventTypes: [AuditEventType.SYSTEM_ERROR] },
        includeMetadata: false,
        includeStateChanges: false,
        format: 'csv' as const,
        retentionDays: 365
      };

      const result = await auditService.generateComplianceReport(reportConfig, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.eventCount).toBe(0);
    });
  });

  describe('Integrity Verification', () => {
    test('should verify audit trail integrity', async () => {
      const mockEvents = [
        {
          id: 'event_1',
          eventType: AuditEventType.TOKEN_ALLOCATION,
          timestamp: new Date(),
          description: 'Test event 1',
          hash: 'valid_hash_1'
        },
        {
          id: 'event_2',
          eventType: AuditEventType.PAYOUT_PROCESSED,
          timestamp: new Date(),
          description: 'Test event 2',
          hash: 'valid_hash_2'
        }
      ];

      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockEvents.map(event => ({
          id: event.id,
          data: () => event
        }))
      });

      // Mock the hash calculation to return the expected hashes
      jest.spyOn(auditService as any, 'calculateEventHash')
        .mockReturnValueOnce('valid_hash_1')
        .mockReturnValueOnce('valid_hash_2');

      const result = await auditService.verifyIntegrity(undefined, undefined, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.totalEvents).toBe(2);
      expect(result.data!.verifiedEvents).toBe(2);
      expect(result.data!.corruptedEvents).toBe(0);
      expect(result.data!.integrityScore).toBe(100);
    });

    test('should detect corrupted audit events', async () => {
      const mockEvents = [
        {
          id: 'event_1',
          eventType: AuditEventType.TOKEN_ALLOCATION,
          timestamp: new Date(),
          description: 'Test event 1',
          hash: 'valid_hash_1'
        },
        {
          id: 'event_2',
          eventType: AuditEventType.PAYOUT_PROCESSED,
          timestamp: new Date(),
          description: 'Test event 2',
          hash: 'corrupted_hash'
        }
      ];

      const { getDocs, setDoc } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockEvents.map(event => ({
          id: event.id,
          data: () => event
        }))
      });
      setDoc.mockResolvedValue(undefined);

      // Mock hash calculation - first valid, second corrupted
      jest.spyOn(auditService as any, 'calculateEventHash')
        .mockReturnValueOnce('valid_hash_1')
        .mockReturnValueOnce('expected_hash_2');

      const result = await auditService.verifyIntegrity(undefined, undefined, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.totalEvents).toBe(2);
      expect(result.data!.verifiedEvents).toBe(1);
      expect(result.data!.corruptedEvents).toBe(1);
      expect(result.data!.integrityScore).toBe(50);
    });
  });

  describe('Data Retention', () => {
    test('should identify events for retention processing', async () => {
      // Mock events that exceed retention period
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago

      const mockEvents = [
        {
          id: 'old_event_1',
          eventType: AuditEventType.LOGIN_SUCCESS,
          timestamp: oldDate,
          description: 'Old login event'
        }
      ];

      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: mockEvents.map(event => ({
          id: event.id,
          data: () => event
        }))
      });

      const result = await auditService.applyRetentionPolicies(true, correlationId); // Dry run

      expect(result.success).toBe(true);
      expect(result.data!.totalEvents).toBeGreaterThanOrEqual(0);
      expect(result.data!.actions).toBeDefined();
    });

    test('should get retention policy for event type', () => {
      const policy = auditService.getRetentionPolicy(AuditEventType.TOKEN_ALLOCATION);
      
      expect(policy).toBeDefined();
      expect(policy!.eventType).toBe(AuditEventType.TOKEN_ALLOCATION);
      expect(policy!.retentionDays).toBe(2555); // 7 years for financial records
      expect(policy!.regulatoryRequirement).toBe('IRS');
    });

    test('should update retention policy', () => {
      const newPolicy = {
        eventType: AuditEventType.LOGIN_SUCCESS,
        retentionDays: 1000,
        regulatoryRequirement: 'Custom'
      };

      auditService.updateRetentionPolicy(newPolicy);
      const retrievedPolicy = auditService.getRetentionPolicy(AuditEventType.LOGIN_SUCCESS);

      expect(retrievedPolicy!.retentionDays).toBe(1000);
      expect(retrievedPolicy!.regulatoryRequirement).toBe('Custom');
    });
  });
});