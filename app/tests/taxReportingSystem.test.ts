/**
 * Comprehensive tests for Tax Reporting System
 * 
 * Tests tax document generation, compliance validation,
 * and international tax handling capabilities.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TaxReportingService, TaxDocumentType } from '../services/taxReportingService';
import { TaxInformationService } from '../services/taxInformationService';
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

describe('Tax Reporting System', () => {
  let taxReportingService: TaxReportingService;
  let taxInfoService: TaxInformationService;
  let correlationId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    taxReportingService = TaxReportingService.getInstance();
    taxInfoService = TaxInformationService.getInstance();
    correlationId = FinancialUtils.generateCorrelationId();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Tax Summary Generation', () => {
    test('should generate annual tax summary for US user', async () => {
      const userId = 'user_us_123';
      const taxYear = 2023;

      // Mock user tax info
      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId,
          taxId: '123456789',
          taxIdType: 'ssn',
          country: 'US',
          state: 'CA',
          isUSPerson: true,
          isBusiness: false,
          w9Submitted: true,
          w8Submitted: false,
          treatyBenefits: false,
          withholdingExempt: false,
          address: {
            line1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'US'
          }
        })
      });

      // Mock earnings data
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'earning_1',
            data: () => ({
              id: 'earning_1',
              userId,
              usdValue: 1500.00,
              tokensEarned: 15000,
              status: 'available',
              createdAt: new Date('2023-03-15'),
              withholdingAmount: 0,
              feeAmount: 45.00
            })
          },
          {
            id: 'earning_2',
            data: () => ({
              id: 'earning_2',
              userId,
              usdValue: 800.00,
              tokensEarned: 8000,
              status: 'available',
              createdAt: new Date('2023-08-20'),
              withholdingAmount: 0,
              feeAmount: 24.00
            })
          }
        ]
      });

      // Mock existing tax documents
      getDocs.mockResolvedValueOnce({
        docs: []
      });

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await taxReportingService.generateAnnualTaxSummary(
        userId,
        taxYear,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.totalEarnings).toBe(2300.00);
      expect(result.data!.totalWithholding).toBe(0);
      expect(result.data!.totalFees).toBe(69.00);
      expect(result.data!.netEarnings).toBe(2231.00);
      expect(result.data!.requiresReporting).toBe(true);
      expect(result.data!.exceedsThreshold).toBe(true);
    });

    test('should generate annual tax summary for foreign user', async () => {
      const userId = 'user_foreign_123';
      const taxYear = 2023;

      // Mock foreign user tax info
      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          userId,
          taxId: 'UK123456789',
          taxIdType: 'foreign',
          country: 'GB',
          isUSPerson: false,
          isBusiness: false,
          w9Submitted: false,
          w8Submitted: true,
          treatyBenefits: true,
          withholdingExempt: false,
          address: {
            line1: '10 Downing Street',
            city: 'London',
            postalCode: 'SW1A 2AA',
            country: 'GB'
          }
        })
      });

      // Mock earnings with withholding
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'earning_1',
            data: () => ({
              id: 'earning_1',
              userId,
              usdValue: 1000.00,
              tokensEarned: 10000,
              status: 'available',
              createdAt: new Date('2023-06-15'),
              withholdingAmount: 150.00, // 15% treaty rate
              feeAmount: 30.00
            })
          }
        ]
      });

      getDocs.mockResolvedValueOnce({
        docs: []
      });

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await taxReportingService.generateAnnualTaxSummary(
        userId,
        taxYear,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data!.totalEarnings).toBe(1000.00);
      expect(result.data!.totalWithholding).toBe(150.00);
      expect(result.data!.netEarnings).toBe(820.00);
      expect(result.data!.requiresReporting).toBe(true);
    });
  });

  describe('Tax Document Generation', () => {
    test('should generate 1099-NEC for eligible US user', async () => {
      const userId = 'user_1099_eligible';
      const taxYear = 2023;

      // Mock user tax info
      const mockUserTaxInfo = {
        userId,
        taxId: '123456789',
        taxIdType: 'ssn',
        country: 'US',
        isUSPerson: true,
        isBusiness: false,
        businessName: undefined,
        w9Submitted: true,
        address: {
          line1: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US'
        }
      };

      // Mock tax summary
      const mockTaxSummary = {
        userId,
        taxYear,
        totalEarnings: 1500.00,
        totalWithholding: 0,
        requiresReporting: true,
        exceedsThreshold: true
      };

      // Mock the private methods
      jest.spyOn(taxReportingService as any, 'getUserTaxInfo')
        .mockResolvedValue(mockUserTaxInfo);
      jest.spyOn(taxReportingService as any, 'getAnnualTaxSummary')
        .mockResolvedValue(mockTaxSummary);
      jest.spyOn(taxReportingService as any, 'createTaxDocument')
        .mockResolvedValue({
          id: '1099_NEC_user_1099_eligible_2023',
          userId,
          type: TaxDocumentType.FORM_1099_NEC,
          taxYear,
          amount: 1500.00,
          withholdingAmount: 0,
          currency: 'usd',
          isRequired: true,
          deadlineDate: new Date(2024, 0, 31),
          generatedAt: new Date(),
          submittedToIRS: false,
          documentHash: 'mock_hash',
          metadata: {},
          correlationId
        });

      const result = await taxReportingService.generate1099NEC(
        userId,
        taxYear,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.type).toBe(TaxDocumentType.FORM_1099_NEC);
      expect(result.data!.amount).toBe(1500.00);
      expect(result.data!.isRequired).toBe(true);
    });

    test('should generate 1042-S for foreign user', async () => {
      const userId = 'user_1042_eligible';
      const taxYear = 2023;

      // Mock foreign user tax info
      const mockUserTaxInfo = {
        userId,
        taxId: 'UK123456789',
        taxIdType: 'foreign',
        country: 'GB',
        isUSPerson: false,
        isBusiness: false,
        w8Submitted: true,
        treatyBenefits: true,
        address: {
          line1: '10 Downing Street',
          city: 'London',
          postalCode: 'SW1A 2AA',
          country: 'GB'
        }
      };

      // Mock tax summary
      const mockTaxSummary = {
        userId,
        taxYear,
        totalEarnings: 2000.00,
        totalWithholding: 300.00,
        requiresReporting: true
      };

      jest.spyOn(taxReportingService as any, 'getUserTaxInfo')
        .mockResolvedValue(mockUserTaxInfo);
      jest.spyOn(taxReportingService as any, 'getAnnualTaxSummary')
        .mockResolvedValue(mockTaxSummary);
      jest.spyOn(taxReportingService as any, 'createTaxDocument')
        .mockResolvedValue({
          id: '1042_S_user_1042_eligible_2023',
          userId,
          type: TaxDocumentType.FORM_1042_S,
          taxYear,
          amount: 2000.00,
          withholdingAmount: 300.00,
          currency: 'usd',
          isRequired: true,
          deadlineDate: new Date(2024, 2, 15),
          generatedAt: new Date(),
          submittedToIRS: false,
          documentHash: 'mock_hash',
          metadata: {},
          correlationId
        });

      const result = await taxReportingService.generate1042S(
        userId,
        taxYear,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.type).toBe(TaxDocumentType.FORM_1042_S);
      expect(result.data!.amount).toBe(2000.00);
      expect(result.data!.withholdingAmount).toBe(300.00);
    });

    test('should reject 1099-NEC for foreign user', async () => {
      const userId = 'user_foreign_no_1099';
      const taxYear = 2023;

      const mockUserTaxInfo = {
        userId,
        isUSPerson: false,
        country: 'CA'
      };

      jest.spyOn(taxReportingService as any, 'getUserTaxInfo')
        .mockResolvedValue(mockUserTaxInfo);

      const result = await taxReportingService.generate1099NEC(
        userId,
        taxYear,
        correlationId
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('1099-NEC not required');
    });
  });

  describe('Withholding Calculations', () => {
    test('should calculate no withholding for US person with valid W-9', async () => {
      const userId = 'user_us_no_withholding';
      const amount = 1000.00;

      const mockUserTaxInfo = {
        userId,
        isUSPerson: true,
        taxId: '123456789',
        w9Submitted: true
      };

      jest.spyOn(taxReportingService as any, 'getUserTaxInfo')
        .mockResolvedValue(mockUserTaxInfo);

      const result = await taxReportingService.calculateWithholding(
        userId,
        amount,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data!.withholdingAmount).toBe(0);
      expect(result.data!.withholdingRate).toBe(0);
      expect(result.data!.netAmount).toBe(1000.00);
    });

    test('should calculate backup withholding for US person without W-9', async () => {
      const userId = 'user_us_backup_withholding';
      const amount = 1000.00;

      const mockUserTaxInfo = {
        userId,
        isUSPerson: true,
        taxId: undefined,
        w9Submitted: false
      };

      jest.spyOn(taxReportingService as any, 'getUserTaxInfo')
        .mockResolvedValue(mockUserTaxInfo);

      const result = await taxReportingService.calculateWithholding(
        userId,
        amount,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data!.withholdingRate).toBe(24); // Backup withholding rate
      expect(result.data!.withholdingAmount).toBe(240.00);
      expect(result.data!.netAmount).toBe(760.00);
    });

    test('should calculate treaty withholding for foreign person with W-8', async () => {
      const userId = 'user_foreign_treaty';
      const amount = 1000.00;

      const mockUserTaxInfo = {
        userId,
        isUSPerson: false,
        treatyBenefits: true,
        w8Submitted: true
      };

      jest.spyOn(taxReportingService as any, 'getUserTaxInfo')
        .mockResolvedValue(mockUserTaxInfo);

      const result = await taxReportingService.calculateWithholding(
        userId,
        amount,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data!.withholdingRate).toBe(15); // Treaty reduced rate
      expect(result.data!.withholdingAmount).toBe(150.00);
      expect(result.data!.netAmount).toBe(850.00);
    });

    test('should calculate default withholding for foreign person without treaty', async () => {
      const userId = 'user_foreign_default';
      const amount = 1000.00;

      const mockUserTaxInfo = {
        userId,
        isUSPerson: false,
        treatyBenefits: false,
        w8Submitted: false
      };

      jest.spyOn(taxReportingService as any, 'getUserTaxInfo')
        .mockResolvedValue(mockUserTaxInfo);

      const result = await taxReportingService.calculateWithholding(
        userId,
        amount,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data!.withholdingRate).toBe(30); // Default foreign rate
      expect(result.data!.withholdingAmount).toBe(300.00);
      expect(result.data!.netAmount).toBe(700.00);
    });
  });

  describe('Bulk Processing', () => {
    test('should process bulk tax generation', async () => {
      const taxYear = 2023;

      // Mock tax summaries query
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValueOnce({
        size: 3,
        docs: [
          {
            data: () => ({
              userId: 'user_1',
              taxYear,
              totalEarnings: 1500.00,
              requiresReporting: true
            })
          },
          {
            data: () => ({
              userId: 'user_2',
              taxYear,
              totalEarnings: 800.00,
              requiresReporting: true
            })
          },
          {
            data: () => ({
              userId: 'user_3',
              taxYear,
              totalEarnings: 200.00,
              requiresReporting: false
            })
          }
        ]
      });

      // Mock successful document generation
      jest.spyOn(taxReportingService as any, 'getUserTaxInfo')
        .mockResolvedValue({
          isUSPerson: true,
          w9Submitted: true
        });

      jest.spyOn(taxReportingService, 'generate1099NEC')
        .mockResolvedValue({
          success: true,
          data: { id: 'mock_document' },
          correlationId
        });

      const result = await taxReportingService.processBulkTaxGeneration(
        taxYear,
        undefined,
        correlationId
      );

      expect(result.success).toBe(true);
      expect(result.data!.totalUsers).toBe(3);
      expect(result.data!.documentsGenerated).toBeGreaterThan(0);
    });
  });
});