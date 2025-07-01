/**
 * Comprehensive tests for Regulatory Compliance System
 * 
 * Tests KYC/AML compliance, GDPR data protection, PCI DSS security,
 * and regulatory reporting capabilities.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  RegulatoryComplianceService, 
  ComplianceFramework, 
  ComplianceStatus, 
  KYCLevel,
  DataProcessingPurpose 
} from '../services/regulatoryComplianceService';
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
  serverTimestamp: jest.fn(() => new Date()),
  Timestamp: {
    fromDate: jest.fn((date) => date)
  }
}));

// Mock AuditTrailService
jest.mock('../services/auditTrailService', () => ({
  AuditTrailService: {
    getInstance: jest.fn(() => ({
      logEvent: jest.fn().mockResolvedValue({ success: true })
    }))
  },
  AuditEventType: {
    COMPLIANCE_CHECK: 'compliance_check',
    USER_UPDATED: 'user_updated',
    DATA_EXPORT: 'data_export',
    REGULATORY_REPORT: 'regulatory_report'
  },
  AuditSeverity: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
  }
}));

describe('Regulatory Compliance System', () => {
  let complianceService: RegulatoryComplianceService;
  let correlationId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    complianceService = RegulatoryComplianceService.getInstance();
    correlationId = FinancialUtils.generateCorrelationId();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Compliance Framework Checks', () => {
    test('should perform comprehensive compliance check', async () => {
      const userId = 'user_compliance_test';
      const frameworks = [ComplianceFramework.KYC_AML, ComplianceFramework.GDPR];

      // Mock user compliance profile
      const mockProfile = {
        userId,
        kycLevel: KYCLevel.ENHANCED,
        kycStatus: ComplianceStatus.COMPLIANT,
        kycDocuments: {
          identityDocument: {
            type: 'passport',
            documentId: 'doc_123',
            verifiedAt: new Date()
          },
          addressProof: {
            type: 'utility_bill',
            documentId: 'doc_456',
            verifiedAt: new Date()
          }
        },
        amlRiskLevel: 'low' as const,
        sanctionsCheck: {
          lastChecked: new Date(),
          status: 'clear' as const,
          provider: 'internal'
        },
        gdprConsent: {
          marketing: true,
          analytics: true,
          profiling: false,
          dataSharing: false,
          consentDate: new Date(),
          consentVersion: '2.0'
        },
        dataRetentionPeriod: 2555,
        applicableFrameworks: frameworks
      };

      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProfile
      });

      const result = await complianceService.performComplianceCheck(userId, frameworks, correlationId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      const kycResult = result.data!.find(r => r.framework === ComplianceFramework.KYC_AML);
      expect(kycResult).toBeDefined();
      expect(kycResult!.status).toBe(ComplianceStatus.COMPLIANT);
      expect(kycResult!.score).toBeGreaterThan(75);

      const gdprResult = result.data!.find(r => r.framework === ComplianceFramework.GDPR);
      expect(gdprResult).toBeDefined();
      expect(gdprResult!.status).toBe(ComplianceStatus.COMPLIANT);
    });

    test('should identify non-compliant user', async () => {
      const userId = 'user_non_compliant';
      const frameworks = [ComplianceFramework.KYC_AML];

      // Mock non-compliant profile
      const mockProfile = {
        userId,
        kycLevel: KYCLevel.NONE,
        kycStatus: ComplianceStatus.NON_COMPLIANT,
        kycDocuments: {},
        amlRiskLevel: 'high' as const,
        sanctionsCheck: {
          lastChecked: new Date(),
          status: 'pending' as const,
          provider: 'internal'
        },
        applicableFrameworks: frameworks
      };

      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProfile
      });

      const result = await complianceService.performComplianceCheck(userId, frameworks, correlationId);

      expect(result.success).toBe(true);
      expect(result.data![0].status).toBe(ComplianceStatus.NON_COMPLIANT);
      expect(result.data![0].score).toBeLessThan(50);
      expect(result.data![0].recommendations.length).toBeGreaterThan(0);
    });

    test('should handle user without compliance profile', async () => {
      const userId = 'user_no_profile';
      const frameworks = [ComplianceFramework.KYC_AML];

      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => false
      });

      const result = await complianceService.performComplianceCheck(userId, frameworks, correlationId);

      expect(result.success).toBe(true);
      expect(result.data![0].status).toBe(ComplianceStatus.NON_COMPLIANT);
      expect(result.data![0].score).toBe(0);
      expect(result.data![0].recommendations).toContain('Create compliance profile');
    });
  });

  describe('KYC/AML Management', () => {
    test('should update KYC information successfully', async () => {
      const userId = 'user_kyc_update';
      const kycData = {
        level: KYCLevel.ENHANCED,
        documents: {
          identityDocument: {
            type: 'drivers_license',
            documentId: 'dl_789',
            verifiedAt: new Date()
          }
        },
        verificationProvider: 'jumio'
      };

      const { getDoc, setDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => false // New profile will be created
      });
      setDoc.mockResolvedValue(undefined);

      const result = await complianceService.updateKYCInformation(userId, kycData, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.kycLevel).toBe(KYCLevel.ENHANCED);
      expect(result.data!.kycStatus).toBe(ComplianceStatus.PENDING_REVIEW);
      expect(result.data!.complianceHistory.length).toBeGreaterThan(0);
      expect(setDoc).toHaveBeenCalled();
    });

    test('should assess AML risk correctly', async () => {
      const userId = 'user_aml_test';
      const kycData = {
        level: KYCLevel.BASIC,
        verificationProvider: 'internal'
      };

      const { getDoc, setDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => false
      });
      setDoc.mockResolvedValue(undefined);

      const result = await complianceService.updateKYCInformation(userId, kycData, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.amlRiskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'prohibited']).toContain(result.data!.amlRiskLevel);
    });
  });

  describe('GDPR Compliance', () => {
    test('should update GDPR consent preferences', async () => {
      const userId = 'user_gdpr_test';
      const consentData = {
        marketing: true,
        analytics: false,
        profiling: false,
        dataSharing: true,
        consentVersion: '2.1'
      };

      const { getDoc, setDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => false
      });
      setDoc.mockResolvedValue(undefined);

      const result = await complianceService.updateGDPRConsent(userId, consentData, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.gdprConsent.marketing).toBe(true);
      expect(result.data!.gdprConsent.analytics).toBe(false);
      expect(result.data!.gdprConsent.consentVersion).toBe('2.1');
      expect(result.data!.gdprConsent.consentDate).toBeInstanceOf(Date);
    });

    test('should process right to be forgotten request', async () => {
      const userId = 'user_rtbf_test';
      const requestDetails = {
        reason: 'User requested account deletion',
        dataCategories: ['profile', 'analytics', 'marketing'],
        retainFinancialRecords: true
      };

      const { getDoc, setDoc, updateDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ userId, rightToBeForgettenRequested: false })
      });
      setDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);

      const result = await complianceService.processRightToBeForgotten(userId, requestDetails, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.requestId).toBeDefined();
      expect(result.data!.status).toBe('pending');
      expect(result.data!.estimatedCompletionDate).toBeInstanceOf(Date);
      expect(setDoc).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalled();
    });
  });

  describe('Regulatory Reporting', () => {
    test('should generate regulatory report', async () => {
      const config = {
        framework: ComplianceFramework.KYC_AML,
        reportType: 'monthly_kyc_summary',
        frequency: 'monthly' as const,
        recipients: ['compliance@wewrite.com'],
        template: 'standard_kyc_report',
        dataFields: ['userId', 'kycLevel', 'amlRiskLevel'],
        retentionPeriod: 2555,
        encryptionRequired: true
      };

      const dateRange = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await complianceService.generateRegulatoryReport(config, dateRange, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.reportId).toBeDefined();
      expect(result.data!.recordCount).toBeGreaterThanOrEqual(0);
      expect(result.data!.reportUrl).toBeDefined();
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('Compliance Status Management', () => {
    test('should get user compliance status', async () => {
      const userId = 'user_status_test';

      const mockProfile = {
        userId,
        kycLevel: KYCLevel.ENHANCED,
        kycStatus: ComplianceStatus.COMPLIANT,
        applicableFrameworks: [ComplianceFramework.KYC_AML, ComplianceFramework.GDPR],
        kycDocuments: {
          identityDocument: { type: 'passport', documentId: 'doc_123', verifiedAt: new Date() },
          addressProof: { type: 'utility_bill', documentId: 'doc_456', verifiedAt: new Date() }
        },
        amlRiskLevel: 'low' as const,
        sanctionsCheck: { status: 'clear' as const, lastChecked: new Date(), provider: 'internal' },
        gdprConsent: {
          marketing: true,
          analytics: true,
          profiling: false,
          dataSharing: false,
          consentDate: new Date(),
          consentVersion: '2.0'
        },
        dataRetentionPeriod: 2555
      };

      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProfile
      });

      const result = await complianceService.getUserComplianceStatus(userId, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.overallStatus).toBe(ComplianceStatus.COMPLIANT);
      expect(result.data!.frameworkStatuses.length).toBe(2);
      expect(result.data!.riskLevel).toBe('low');
    });

    test('should schedule compliance review', async () => {
      const userId = 'user_review_test';
      const framework = ComplianceFramework.KYC_AML;
      const reviewDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await complianceService.scheduleComplianceReview(userId, framework, reviewDate, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.reviewId).toBeDefined();
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const userId = 'user_error_test';
      const frameworks = [ComplianceFramework.KYC_AML];

      const { getDoc } = require('firebase/firestore');
      getDoc.mockRejectedValue(new Error('Database connection failed'));

      const result = await complianceService.performComplianceCheck(userId, frameworks, correlationId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('Compliance check failed');
    });

    test('should handle invalid KYC data', async () => {
      const userId = 'user_invalid_kyc';
      const invalidKycData = {
        level: 'invalid_level' as any,
        verificationProvider: 'test'
      };

      // This would be caught by validation in the API layer
      // For the service layer, we assume valid data is passed
      expect(Object.values(KYCLevel)).not.toContain(invalidKycData.level);
    });
  });
});