/**
 * Comprehensive tests for Fraud Detection System
 * 
 * Tests fraud detection rules, response mechanisms,
 * and automated security measures.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FraudDetectionEngine, FraudRuleType, FraudSeverity, FraudAction } from '../services/fraudDetectionEngine';
import { FraudResponseService } from '../services/fraudResponseService';
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
  increment: jest.fn((value) => ({ _increment: value }))}));

describe('Fraud Detection System', () => {
  let fraudEngine: FraudDetectionEngine;
  let responseService: FraudResponseService;
  let correlationId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    fraudEngine = FraudDetectionEngine.getInstance();
    responseService = FraudResponseService.getInstance();
    correlationId = FinancialUtils.generateCorrelationId();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Fraud Detection Engine', () => {
    test('should detect high velocity transactions', async () => {
      const userId = 'user_velocity_test';
      const context = {
        userId,
        transactionType: 'token_transfer',
        amount: 100,
        currency: 'usd',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        metadata: {}
      };

      // Mock high transaction count
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValueOnce({
        size: 15 // Exceeds default threshold of 10
      });

      // Mock user profile
      const { getDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({
        exists: () => false
      });

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await fraudEngine.analyzeTransaction(context, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.isFraudulent).toBe(true);
      expect(result.data!.riskScore).toBeGreaterThan(50);
      expect(result.data!.triggeredRules.length).toBeGreaterThan(0);
      
      const velocityRule = result.data!.triggeredRules.find(r => r.type === FraudRuleType.VELOCITY_CHECK);
      expect(velocityRule).toBeDefined();
    });

    test('should detect suspicious amount patterns', async () => {
      const userId = 'user_pattern_test';
      const context = {
        userId,
        transactionType: 'payout_request',
        amount: 500.00,
        currency: 'usd',
        timestamp: new Date(),
        metadata: {}
      };

      // Mock transactions with similar amounts
      const { getDocs } = require('firebase/firestore');
      getDocs
        .mockResolvedValueOnce({ size: 3 }) // Velocity check
        .mockResolvedValueOnce({ // Pattern analysis
          docs: [
            { data: () => ({ amount: 500.00 }) },
            { data: () => ({ amount: 499.50 }) },
            { data: () => ({ amount: 500.50 }) },
            { data: () => ({ amount: 501.00 }) },
            { data: () => ({ amount: 499.00 }) }
          ]
        });

      const { getDoc, setDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({ exists: () => false });
      setDoc.mockResolvedValue(undefined);

      const result = await fraudEngine.analyzeTransaction(context, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.isFraudulent).toBe(true);
      
      const patternRule = result.data!.triggeredRules.find(r => r.type === FraudRuleType.PATTERN_ANALYSIS);
      expect(patternRule).toBeDefined();
    });

    test('should detect account abuse from same IP', async () => {
      const userId = 'user_abuse_test';
      const context = {
        userId,
        transactionType: 'account_creation',
        amount: 0,
        currency: 'usd',
        timestamp: new Date(),
        ipAddress: '192.168.1.100',
        deviceFingerprint: 'device_123',
        metadata: {}
      };

      // Mock multiple accounts from same IP
      const { getDocs } = require('firebase/firestore');
      getDocs
        .mockResolvedValueOnce({ size: 2 }) // Velocity check
        .mockResolvedValueOnce({ docs: [] }) // Pattern analysis
        .mockResolvedValueOnce({ // Account abuse - IP check
          docs: [
            { data: () => ({ userId: 'user1' }) },
            { data: () => ({ userId: 'user2' }) },
            { data: () => ({ userId: 'user3' }) },
            { data: () => ({ userId: 'user4' }) }
          ]
        })
        .mockResolvedValueOnce({ // Account abuse - device check
          docs: [
            { data: () => ({ userId: 'user1' }) },
            { data: () => ({ userId: 'user2' }) }
          ]
        });

      const { getDoc, setDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({ exists: () => false });
      setDoc.mockResolvedValue(undefined);

      const result = await fraudEngine.analyzeTransaction(context, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.isFraudulent).toBe(true);
      
      const abuseRule = result.data!.triggeredRules.find(r => r.type === FraudRuleType.ACCOUNT_ABUSE);
      expect(abuseRule).toBeDefined();
    });

    test('should detect token manipulation', async () => {
      const userId = 'user_token_manipulation';
      const context = {
        userId,
        transactionType: 'token_earning',
        amount: 1500,
        currency: 'tokens',
        timestamp: new Date(),
        metadata: {}
      };

      // Mock token balance and recent earnings
      const { getDoc, getDocs } = require('firebase/firestore');
      getDoc
        .mockResolvedValueOnce({ exists: () => false }) // User profile
        .mockResolvedValueOnce({ // Token balance
          exists: () => true,
          data: () => ({
            availableTokens: 5000,
            totalEarned: 10000
          })
        });

      getDocs
        .mockResolvedValueOnce({ size: 2 }) // Velocity
        .mockResolvedValueOnce({ docs: [] }) // Pattern
        .mockResolvedValueOnce({ docs: [] }) // Account abuse IP
        .mockResolvedValueOnce({ docs: [] }) // Account abuse device
        .mockResolvedValueOnce({ // Token earnings
          docs: [
            { data: () => ({ tokensEarned: 1200 }) },
            { data: () => ({ tokensEarned: 800 }) }
          ]
        });

      const { setDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);

      const result = await fraudEngine.analyzeTransaction(context, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.isFraudulent).toBe(true);
      
      const tokenRule = result.data!.triggeredRules.find(r => r.type === FraudRuleType.TOKEN_MANIPULATION);
      expect(tokenRule).toBeDefined();
    });

    test('should detect geographic anomalies', async () => {
      const userId = 'user_geo_anomaly';
      const context = {
        userId,
        transactionType: 'login',
        amount: 0,
        currency: 'usd',
        timestamp: new Date(),
        geolocation: {
          country: 'US',
          region: 'CA',
          city: 'San Francisco',
          latitude: 37.7749,
          longitude: -122.4194
        },
        metadata: {}
      };

      // Mock recent sessions from different location
      const { getDocs } = require('firebase/firestore');
      getDocs
        .mockResolvedValueOnce({ size: 1 }) // Velocity
        .mockResolvedValueOnce({ docs: [] }) // Pattern
        .mockResolvedValueOnce({ docs: [] }) // Account abuse IP
        .mockResolvedValueOnce({ docs: [] }) // Account abuse device
        .mockResolvedValueOnce({ docs: [] }) // Token manipulation
        .mockResolvedValueOnce({ // Geographic sessions
          docs: [
            {
              data: () => ({
                geolocation: {
                  latitude: 51.5074, // London
                  longitude: -0.1278
                },
                createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
              })
            }
          ]
        });

      const { getDoc, setDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({ exists: () => false });
      setDoc.mockResolvedValue(undefined);

      const result = await fraudEngine.analyzeTransaction(context, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.isFraudulent).toBe(true);
      
      const geoRule = result.data!.triggeredRules.find(r => r.type === FraudRuleType.GEOGRAPHIC_ANOMALY);
      expect(geoRule).toBeDefined();
    });

    test('should not trigger false positives for normal activity', async () => {
      const userId = 'user_normal_activity';
      const context = {
        userId,
        transactionType: 'token_allocation',
        amount: 50,
        currency: 'usd',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        metadata: {}
      };

      // Mock normal activity levels
      const { getDocs } = require('firebase/firestore');
      getDocs
        .mockResolvedValueOnce({ size: 2 }) // Low velocity
        .mockResolvedValueOnce({ docs: [] }) // No pattern
        .mockResolvedValueOnce({ docs: [{ data: () => ({ userId }) }] }) // Single account
        .mockResolvedValueOnce({ docs: [{ data: () => ({ userId }) }] }) // Single device
        .mockResolvedValueOnce({ docs: [{ data: () => ({ tokensEarned: 50 }) }] }) // Normal tokens
        .mockResolvedValueOnce({ docs: [] }); // No geo data

      const { getDoc, setDoc } = require('firebase/firestore');
      getDoc.mockResolvedValue({ exists: () => false });
      setDoc.mockResolvedValue(undefined);

      const result = await fraudEngine.analyzeTransaction(context, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.isFraudulent).toBe(false);
      expect(result.data!.riskScore).toBeLessThan(50);
      expect(result.data!.triggeredRules.length).toBe(0);
    });
  });

  describe('Fraud Response Service', () => {
    test('should execute flag account action', async () => {
      const userId = 'user_flag_test';
      const fraudResult = {
        isFraudulent: true,
        riskScore: 60,
        severity: FraudSeverity.MEDIUM,
        triggeredRules: [],
        recommendedActions: [FraudAction.FLAG_ACCOUNT],
        metadata: {},
        correlationId
      };

      const { updateDoc } = require('firebase/firestore');
      updateDoc.mockResolvedValue(undefined);

      const result = await responseService.executeResponse(userId, fraudResult, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(1);
      expect(result.data![0].action).toBe(FraudAction.FLAG_ACCOUNT);
      expect(result.data![0].success).toBe(true);
      expect(updateDoc).toHaveBeenCalled();
    });

    test('should execute suspend account action', async () => {
      const userId = 'user_suspend_test';
      const fraudResult = {
        isFraudulent: true,
        riskScore: 95,
        severity: FraudSeverity.CRITICAL,
        triggeredRules: [],
        recommendedActions: [FraudAction.SUSPEND_ACCOUNT],
        metadata: {},
        correlationId
      };

      const { setDoc, updateDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);

      const result = await responseService.executeResponse(userId, fraudResult, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(1);
      expect(result.data![0].action).toBe(FraudAction.SUSPEND_ACCOUNT);
      expect(result.data![0].success).toBe(true);
      expect(setDoc).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalled();
    });

    test('should handle multiple actions in sequence', async () => {
      const userId = 'user_multiple_actions';
      const fraudResult = {
        isFraudulent: true,
        riskScore: 75,
        severity: FraudSeverity.HIGH,
        triggeredRules: [],
        recommendedActions: [
          FraudAction.FLAG_ACCOUNT,
          FraudAction.RATE_LIMIT,
          FraudAction.REQUIRE_VERIFICATION
        ],
        metadata: {},
        correlationId
      };

      const { setDoc, updateDoc } = require('firebase/firestore');
      setDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);

      const result = await responseService.executeResponse(userId, fraudResult, correlationId);

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(3);
      expect(result.data!.every(r => r.success)).toBe(true);
    });

    test('should check and remove expired restrictions', async () => {
      const userId = 'user_expired_restrictions';
      
      // Mock expired restrictions
      const expiredDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const mockRestrictions = {
        userId,
        restrictions: {
          suspended: false,
          rateLimited: true,
          requiresVerification: false,
          paymentBlocked: false,
          tokenTransferBlocked: false
        },
        expiresAt: expiredDate
      };

      jest.spyOn(responseService, 'getAccountRestrictions')
        .mockResolvedValue(mockRestrictions);

      const hasRestrictions = await responseService.hasActiveRestrictions(userId);

      expect(hasRestrictions).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete fraud detection and response flow', async () => {
      const userId = 'user_integration_test';
      const context = {
        userId,
        transactionType: 'suspicious_transfer',
        amount: 1000,
        currency: 'usd',
        timestamp: new Date(),
        ipAddress: '192.168.1.1',
        metadata: {}
      };

      // Mock high-risk scenario
      const { getDocs, getDoc, setDoc, updateDoc } = require('firebase/firestore');
      getDocs.mockResolvedValue({ size: 15 }); // High velocity
      getDoc.mockResolvedValue({ exists: () => false });
      setDoc.mockResolvedValue(undefined);
      updateDoc.mockResolvedValue(undefined);

      // Analyze transaction
      const analysisResult = await fraudEngine.analyzeTransaction(context, correlationId);
      expect(analysisResult.success).toBe(true);
      expect(analysisResult.data!.isFraudulent).toBe(true);

      // Execute response
      const responseResult = await responseService.executeResponse(
        userId,
        analysisResult.data!,
        correlationId
      );
      expect(responseResult.success).toBe(true);
      expect(responseResult.data!.length).toBeGreaterThan(0);
    });
  });
});