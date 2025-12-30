/**
 * Integration tests for USD allocation API endpoints
 */

import { createMocks } from 'node-mocks-http';
import { GET, POST } from '../../../app/api/usd/allocate/route';
import { UsdService } from '../../../app/services/usdService';

// Mock the UsdService
jest.mock('../../../app/services/usdService');
const mockUsdService = UsdService as jest.Mocked<typeof UsdService>;

// Mock the auth utility
jest.mock('../../../app/utils/auth', () => ({
  getUserIdFromRequest: jest.fn()
}));

import { getUserIdFromRequest } from '../../../app/utils/auth';
const mockGetUserIdFromRequest = getUserIdFromRequest as jest.MockedFunction<typeof getUserIdFromRequest>;

describe('/api/usd/allocate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/usd/allocate', () => {
    test('successfully allocates USD to a page', async () => {
      const mockUserId = 'test-user-123';
      const pageId = 'test-page-456';
      const usdCentsChange = 250; // $2.50

      const mockUpdatedBalance = {
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
      mockUsdService.allocateUsdToPage.mockResolvedValue(undefined);
      mockUsdService.getUserUsdBalance.mockResolvedValue(mockUpdatedBalance);
      mockUsdService.getCurrentPageAllocation.mockResolvedValue(250);

      const { req } = createMocks({
        method: 'POST',
        body: {
          pageId,
          usdCentsChange
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.balance).toEqual(mockUpdatedBalance);
      expect(data.currentPageAllocation).toBe(250);
      expect(data.message).toContain('Successfully allocated');
      expect(mockUsdService.allocateUsdToPage).toHaveBeenCalledWith(mockUserId, pageId, usdCentsChange);
    });

    test('successfully removes USD allocation (negative change)', async () => {
      const mockUserId = 'test-user-123';
      const pageId = 'test-page-456';
      const usdCentsChange = -100; // Remove $1.00

      const mockUpdatedBalance = {
        userId: mockUserId,
        totalUsdCents: 1000,
        allocatedUsdCents: 150,
        availableUsdCents: 850,
        monthlyAllocationCents: 1000,
        lastAllocationDate: '2024-01',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockUsdService.allocateUsdToPage.mockResolvedValue(undefined);
      mockUsdService.getUserUsdBalance.mockResolvedValue(mockUpdatedBalance);
      mockUsdService.getCurrentPageAllocation.mockResolvedValue(150);

      const { req } = createMocks({
        method: 'POST',
        body: {
          pageId,
          usdCentsChange
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.currentPageAllocation).toBe(150);
    });

    test('returns 401 for unauthenticated user', async () => {
      mockGetUserIdFromRequest.mockResolvedValue(null);

      const { req } = createMocks({
        method: 'POST',
        body: {
          pageId: 'test-page',
          usdCentsChange: 100
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('returns 400 for missing pageId', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);

      const { req } = createMocks({
        method: 'POST',
        body: {
          usdCentsChange: 100
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Page ID is required');
    });

    test('returns 400 for invalid usdCentsChange', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);

      const { req } = createMocks({
        method: 'POST',
        body: {
          pageId: 'test-page',
          usdCentsChange: 'invalid'
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('USD cents change must be a number');
    });

    test('handles service errors with user-friendly messages', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockUsdService.allocateUsdToPage.mockRejectedValue(new Error('balance not found'));

      const { req } = createMocks({
        method: 'POST',
        body: {
          pageId: 'test-page',
          usdCentsChange: 100
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('USD balance not found. Please check your subscription status.');
    });

    test('handles subscription-related errors', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockUsdService.allocateUsdToPage.mockRejectedValue(new Error('subscription error'));

      const { req } = createMocks({
        method: 'POST',
        body: {
          pageId: 'test-page',
          usdCentsChange: 100
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Please check your subscription status and try again.');
    });
  });

  describe('GET /api/usd/allocate', () => {
    test('returns current page allocation', async () => {
      const mockUserId = 'test-user-123';
      const pageId = 'test-page-456';
      const currentAllocation = 250;

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockUsdService.getCurrentPageAllocation.mockResolvedValue(currentAllocation);

      const { req } = createMocks({
        method: 'GET',
        query: { pageId }
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pageId).toBe(pageId);
      expect(data.currentAllocation).toBe(currentAllocation);
      expect(data.currentAllocationFormatted).toBe('$2.50');
    });

    test('returns 401 for unauthenticated user', async () => {
      mockGetUserIdFromRequest.mockResolvedValue(null);

      const { req } = createMocks({
        method: 'GET',
        query: { pageId: 'test-page' }
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    test('returns 400 for missing pageId', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);

      const { req } = createMocks({
        method: 'GET',
        query: {}
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Page ID is required');
    });

    test('returns zero allocation for non-existent allocation', async () => {
      const mockUserId = 'test-user-123';
      const pageId = 'non-existent-page';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockUsdService.getCurrentPageAllocation.mockResolvedValue(0);

      const { req } = createMocks({
        method: 'GET',
        query: { pageId }
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.currentAllocation).toBe(0);
      expect(data.currentAllocationFormatted).toBe('$0.00');
    });

    test('handles service errors', async () => {
      const mockUserId = 'test-user-123';

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockUsdService.getCurrentPageAllocation.mockRejectedValue(new Error('Database error'));

      const { req } = createMocks({
        method: 'GET',
        query: { pageId: 'test-page' }
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get current allocation');
    });
  });

  describe('Edge cases and validation', () => {
    test('handles zero USD allocation', async () => {
      const mockUserId = 'test-user-123';
      const pageId = 'test-page-456';
      const usdCentsChange = 0;

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockUsdService.allocateUsdToPage.mockResolvedValue(undefined);
      mockUsdService.getUserUsdBalance.mockResolvedValue({
        userId: mockUserId,
        totalUsdCents: 1000,
        allocatedUsdCents: 0,
        availableUsdCents: 1000,
        monthlyAllocationCents: 1000,
        lastAllocationDate: '2024-01',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockUsdService.getCurrentPageAllocation.mockResolvedValue(0);

      const { req } = createMocks({
        method: 'POST',
        body: {
          pageId,
          usdCentsChange
        }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('handles very large USD allocations', async () => {
      const mockUserId = 'test-user-123';
      const pageId = 'test-page-456';
      const usdCentsChange = 100000; // $1000

      mockGetUserIdFromRequest.mockResolvedValue(mockUserId);
      mockUsdService.allocateUsdToPage.mockResolvedValue(undefined);
      mockUsdService.getUserUsdBalance.mockResolvedValue({
        userId: mockUserId,
        totalUsdCents: 100000,
        allocatedUsdCents: 100000,
        availableUsdCents: 0,
        monthlyAllocationCents: 100000,
        lastAllocationDate: '2024-01',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockUsdService.getCurrentPageAllocation.mockResolvedValue(100000);

      const { req } = createMocks({
        method: 'POST',
        body: {
          pageId,
          usdCentsChange
        }
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
    });
  });
});
