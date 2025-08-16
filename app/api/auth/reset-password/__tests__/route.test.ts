/**
 * Tests for password reset API endpoints
 */

import { POST, PUT, GET } from '../route';

// Polyfill for Request and Response in test environment
global.Request = global.Request || class MockRequest {
  constructor(public url: string, public init: any = {}) {}
  json() { return Promise.resolve(JSON.parse(this.init.body || '{}')); }
};

global.Response = global.Response || class MockResponse {
  constructor(public body: any, public init: any = {}) {}
  static json(data: any, init: any = {}) {
    return new MockResponse(JSON.stringify(data), init);
  }
  json() { return Promise.resolve(JSON.parse(this.body)); }
  get status() { return this.init.status || 200; }
};

// Mock Firebase Admin
jest.mock('../../../../firebase/firebaseAdmin', () => ({
  getFirebaseAdmin: jest.fn(),
  getFirebaseAdminError: jest.fn()
}));

// Mock environment utilities
jest.mock('../../../../utils/environmentConfig', () => ({
  getEnvironmentType: jest.fn(() => 'development')
}));

// Mock Firebase error handler
jest.mock('../../../../utils/firebase-error-handler', () => ({
  enhanceFirebaseError: jest.fn(),
  logEnhancedFirebaseError: jest.fn()
}));

// Mock API response utilities
jest.mock('../../../auth-helper', () => ({
  createApiResponse: jest.fn((data) => Response.json(data)),
  createErrorResponse: jest.fn((type, message) => Response.json({ error: message }, { status: 500 }))
}));

import { getFirebaseAdmin } from '../../../../firebase/firebaseAdmin';
import { enhanceFirebaseError, logEnhancedFirebaseError } from '../../../../utils/firebase-error-handler';
import { createApiResponse, createErrorResponse } from '../../../auth-helper';

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

      const mockRequest = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Service temporarily unavailable');
      expect(mockCreateErrorResponse).toHaveBeenCalledWith('INTERNAL_ERROR', 'Service temporarily unavailable');
    });

    test('should return validation error for invalid email', async () => {
      mockCreateErrorResponse.mockReturnValue(
        Response.json({ error: 'Please enter a valid email address (example: user@domain.com)' }, { status: 400 })
      );

      const mockRequest = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(mockRequest);
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

      const mockRequest = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Password reset failed');
      expect(data.error).toContain('Technical details');
      expect(data.error).toContain('Unexpected Firebase error');
      expect(mockLogEnhancedFirebaseError).toHaveBeenCalled();
    });
  });

  describe('Error message enhancement', () => {
    test('should provide detailed error information for debugging', async () => {
      const testError = new Error('Test error message');
      testError.name = 'TestError';
      
      const mockAuth = {
        getUserByEmail: jest.fn().mockRejectedValue(testError)
      };
      
      mockGetFirebaseAdmin.mockReturnValue({ auth: () => mockAuth } as any);
      
      mockEnhanceFirebaseError.mockReturnValue({
        userMessage: 'Password reset failed due to an unexpected error',
        technicalDetails: 'Firebase Error [unknown]: Test error message',
        suggestedActions: ['Try again in a few minutes'],
        errorCategory: 'auth',
        shouldRetry: true
      });

      // Mock the enhanced error response
      mockCreateErrorResponse.mockImplementation((type, message) => {
        expect(message).toContain('Technical details');
        expect(message).toContain('TestError');
        expect(message).toContain('Test error message');
        return Response.json({ error: message }, { status: 500 });
      });

      const mockRequest = new Request('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' }
      });

      await POST(mockRequest);

      expect(mockCreateErrorResponse).toHaveBeenCalled();
      expect(mockLogEnhancedFirebaseError).toHaveBeenCalledWith(testError, 'Password Reset - Outer Catch');
    });
  });
});
