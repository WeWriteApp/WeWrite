import { NextResponse } from 'next/server';

// Type definitions
interface ApiResponse<T = any> {
  success: boolean;
  timestamp: string;
  data?: T;
  error?: string;
}

interface ApiError {
  message: string;
  status: number;
}

type ApiErrorType = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL_ERROR' | 'FEATURE_DISABLED';

// Standard API errors
const ApiErrors: Record<ApiErrorType, ApiError> = {
  UNAUTHORIZED: { message: 'Authentication required', status: 401 },
  FORBIDDEN: { message: 'Access denied', status: 403 },
  NOT_FOUND: { message: 'Resource not found', status: 404 },
  BAD_REQUEST: { message: 'Invalid request', status: 400 },
  INTERNAL_ERROR: { message: 'Internal server error', status: 500 },
  FEATURE_DISABLED: { message: 'Feature temporarily disabled', status: 503 }
};

/**
 * Create standardized API response
 */
export const createApiResponse = <T>(
  data: T | null = null,
  message: string | null = null,
  status: number = 200
): Response => {
  const response: ApiResponse<T> = {
    success: status >= 200 && status < 300,
    timestamp: new Date().toISOString(),
    ...(data !== null && { data }),
    ...(message && { error: message })
  };

  return NextResponse.json(response, { status });
};

/**
 * Create standardized error response
 */
export const createErrorResponse = (
  errorType: ApiErrorType,
  customMessage: string | null = null
): Response => {
  const error = ApiErrors[errorType] || ApiErrors.INTERNAL_ERROR;
  return createApiResponse(null, customMessage || error.message, error.status);
};

/**
 * Create standardized success response
 */
export const createSuccessResponse = <T>(
  data: T,
  message: string | null = null
): Response => {
  return createApiResponse(data, message, 200);
};
