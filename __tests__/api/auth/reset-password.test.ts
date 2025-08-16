/**
 * Tests for password reset API endpoints
 */

import { createMocks } from 'node-mocks-http';
import { POST, PUT, GET } from '../../../app/api/auth/reset-password/route';

// Mock Firebase Admin
jest.mock('../../../app/utils/firebase-admin', () => ({
  getFirebaseAdmin: jest.fn(),
  getFirebaseAdminError: jest.fn(),
  initAdmin: jest.fn()
}));

// Mock environment utilities
jest.mock('../../../app/utils/environment', () => ({
  getEnvironmentType: jest.fn(() => 'development')
}));

// Mock Firebase error handler
jest.mock('../../../app/utils/firebase-error-handler', () => ({
  enhanceFirebaseError: jest.fn(),
  logEnhancedFirebaseError: jest.fn()
}));

// Mock API response utilities
jest.mock('../../../app/utils/api-response', () => ({
  createApiResponse: jest.fn((data) => Response.json(data)),
  createErrorResponse: jest.fn((type, message) => Response.json({ error: message }, { status: 500 }))
}));

import { getFirebaseAdmin } from '../../../app/utils/firebase-admin';
import { enhanceFirebaseError, logEnhancedFirebaseError } from '../../../app/utils/firebase-error-handler';
import { createApiResponse, createErrorResponse } from '../../../app/utils/api-response';

const mockGetFirebaseAdmin = getFirebaseAdmin as jest.MockedFunction<typeof getFirebaseAdmin>;
const mockEnhanceFirebaseError = enhanceFirebaseError as jest.MockedFunction<typeof enhanceFirebaseError>;
const mockLogEnhancedFirebaseError = logEnhancedFirebaseError as jest.MockedFunction<typeof logEnhancedFirebaseError>;
const mockCreateApiResponse = createApiResponse as jest.MockedFunction<typeof createApiResponse>;
const mockCreateErrorResponse = createErrorResponse as jest.MockedFunction<typeof createErrorResponse>;

describe('/api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'group').mockImplementation();
    jest.spyOn(console, 'groupEnd').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST - Send password reset email', () => {
    test('should return enhanced error message when Firebase Admin is not available', async () => {
      mockGetFirebaseAdmin.mockReturnValue(null);
      mockCreateErrorResponse.mockReturnValue(
        Response.json({ error: 'Service temporarily unavailable' }, { status: 500 })
      );

      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Service temporarily unavailable');
      expect(mockCreateErrorResponse).toHaveBeenCalledWith('INTERNAL_ERROR', 'Service temporarily unavailable');
    });

    test('should return validation error for invalid email', async () => {
      mockCreateErrorResponse.mockReturnValue(
        Response.json({ error: 'Please enter a valid email address (example: user@domain.com)' }, { status: 400 })
      );

      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Please enter a valid email address (example: user@domain.com)');
    });

    test('should handle unexpected errors with enhanced error messages', async () => {
      const mockAuth = {
        getUserByEmail: jest.fn().mockRejectedValue(new Error('Unexpected Firebase error'))
      };
      
      mockGetFirebaseAdmin.mockReturnValue({ auth: () => mockAuth } as any);
      
      mockEnhanceFirebaseError.mockReturnValue({
        userMessage: 'Password reset failed due to an unexpected error',
        technicalDetails: 'Firebase Error [unknown]: Unexpected Firebase error',
        suggestedActions: ['Try again in a few minutes'],
        errorCategory: 'auth',
        shouldRetry: true
      });

      mockCreateErrorResponse.mockReturnValue(
        Response.json({ 
          error: 'Password reset failed: Error - Unexpected Firebase error. Technical details: Error - Unexpected Firebase error (0ms). Please try again or contact support with this information.' 
        }, { status: 500 })
      );

      const { req } = createMocks({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Password reset failed');
      expect(data.error).toContain('Technical details');
      expect(data.error).toContain('Unexpected Firebase error');
      expect(mockLogEnhancedFirebaseError).toHaveBeenCalled();
    });
  });

  describe('PUT - Confirm password reset', () => {
    test('should handle missing Firebase API key', async () => {
      // Mock missing API key
      const originalEnv = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

      mockCreateErrorResponse.mockReturnValue(
        Response.json({ 
          error: 'Failed to reset password: Error - Firebase API key not configured. Please try again or contact support.' 
        }, { status: 500 })
      );

      const { req } = createMocks({
        method: 'PUT',
        body: JSON.stringify({ 
          oobCode: 'test-code',
          newPassword: 'newpassword123'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await PUT(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Firebase API key not configured');

      // Restore environment
      if (originalEnv) {
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY = originalEnv;
      }
    });
  });

  describe('GET - Verify reset code', () => {
    test('should return validation error for missing reset code', async () => {
      mockCreateErrorResponse.mockReturnValue(
        Response.json({ error: 'Reset code is required' }, { status: 400 })
      );

      const { req } = createMocks({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/reset-password'
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Reset code is required');
    });

    test('should handle Firebase Admin unavailable', async () => {
      mockGetFirebaseAdmin.mockReturnValue(null);
      mockCreateErrorResponse.mockReturnValue(
        Response.json({ error: 'Service temporarily unavailable' }, { status: 500 })
      );

      const { req } = createMocks({
        method: 'GET',
        url: 'http://localhost:3000/api/auth/reset-password?oobCode=test-code'
      });

      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Service temporarily unavailable');
    });
  });
});
