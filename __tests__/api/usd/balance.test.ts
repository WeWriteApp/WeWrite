/**
 * Integration tests for USD balance API endpoints
 */

import { createMocks } from 'node-mocks-http';
import { GET, POST } from '../../../app/api/usd/balance/route';
import { ServerUsdService } from '../../../app/services/usdService.server';

// Mock the ServerUsdService
jest.mock('../../../app/services/usdService.server');
const mockServerUsdService = ServerUsdService as jest.Mocked<typeof ServerUsdService>;

// Mock the auth utility
jest.mock('../../../app/utils/auth', () => ({
  getUserIdFromRequest: jest.fn()
}));

import { getUserIdFromRequest } from '../../../app/utils/auth';
const mockGetUserIdFromRequest = getUserIdFromRequest as jest.MockedFunction<typeof getUserIdFromRequest>;

describe('/api/usd/balance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/usd/balance', () => {
    test('returns USD balance for authenticated user', async () => {
      const mockUserId = 'test-user-123';
      const mockBalance = {
        userId: mockUserId,
        totalUsdCents: 1000,
        allocatedUsdCents: 250,
        availableUsdCents: 750,
        monthlyAllocationCents: 1000,
        lastAllocationDate: '2024-01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockServerUsdService.getUserUsdBalance.mockResolvedValue(mockBalance);
      mockServerUsdService.getUserUsdAllocations.mockResolvedValue([]);

      const { req } = createMocks({ method: 'GET' });
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.balance).toEqual(mockBalance);
      expect(data.allocations).toEqual([]);
      expect(data.summary.totalUsdCents).toBe(1000);
      expect(data.summary.allocatedUsdCents).toBe(250);
      expect(data.summary.availableUsdCents).toBe(750);
    });

    test('returns 401 for unauthenticated user', async () => {
      mockGetUserIdFromRequest.mockResolvedValue(null);

      const { req } = createMocks({ method: 'GET' });
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('returns empty balance when no USD balance exists', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockServerUsdService.getUserUsdBalance.mockResolvedValue(null);

      const { req } = createMocks({ method: 'GET' });
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.balance).toBeNull();
      expect(data.summary.totalUsdCents).toBe(0);
      expect(data.message).toContain('No USD balance found');
    });

    test('handles service errors gracefully', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockServerUsdService.getUserUsdBalance.mockRejectedValue(new Error('Database error'));

      const { req } = createMocks({ method: 'GET' });
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get USD balance');
    });
  });

  describe('POST /api/usd/balance', () => {
    test('initializes USD balance with valid subscription amount', async () => {
      const mockUserId = 'test-user-123';
      const subscriptionAmount = 25;
      const mockBalance = {
        userId: mockUserId,
        totalUsdCents: 2500,
        allocatedUsdCents: 0,
        availableUsdCents: 2500,
        monthlyAllocationCents: 2500,
        lastAllocationDate: '2024-01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockServerUsdService.updateMonthlyUsdAllocation.mockResolvedValue(undefined);
      mockServerUsdService.getUserUsdBalance.mockResolvedValue(mockBalance);

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'initialize',
          subscriptionAmount
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.balance).toEqual(mockBalance);
      expect(data.message).toContain('initialized successfully');
      expect(mockServerUsdService.updateMonthlyUsdAllocation).toHaveBeenCalledWith(mockUserId, subscriptionAmount);
    });

    test('returns 401 for unauthenticated user', async () => {
      mockGetUserIdFromRequest.mockResolvedValue(null);

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'initialize',
          subscriptionAmount: 25
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('returns 400 for invalid subscription amount', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'initialize',
          subscriptionAmount: -10
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Valid subscription amount is required');
    });

    test('returns 400 for missing subscription amount', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'initialize'
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Valid subscription amount is required');
    });

    test('returns 400 for invalid action', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'invalid-action',
          subscriptionAmount: 25
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid action');
    });

    test('handles service errors during initialization', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockServerUsdService.updateMonthlyUsdAllocation.mockRejectedValue(new Error('Database error'));

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'initialize',
          subscriptionAmount: 25
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process USD balance request');
    });
  });

  describe('Error handling and edge cases', () => {
    test('handles malformed JSON in POST request', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);

      const { req } = createMocks({
        method: 'POST',
        body: 'invalid-json'
      });

      // Mock the json() method to throw an error
      req.json = jest.fn().mockRejectedValue(new Error('Invalid JSON'));

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process USD balance request');
    });

    test('handles very large subscription amounts', async () => {
      const mockUserId = 'test-user-123';
      const largeAmount = 10000;
      const mockBalance = {
        userId: mockUserId,
        totalUsdCents: 1000000,
        allocatedUsdCents: 0,
        availableUsdCents: 1000000,
        monthlyAllocationCents: 1000000,
        lastAllocationDate: '2024-01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockServerUsdService.updateMonthlyUsdAllocation.mockResolvedValue(undefined);
      mockServerUsdService.getUserUsdBalance.mockResolvedValue(mockBalance);

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'initialize',
          subscriptionAmount: largeAmount
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.balance.totalUsdCents).toBe(1000000);
    });
  });
});
