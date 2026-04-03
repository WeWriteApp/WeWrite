/**
 * Legacy compatibility shim.
 * All exports delegate to the canonical module at api/auth-helper.ts.
 */
export { createApiResponse, createErrorResponse, createSuccessResponse } from '../api/auth-helper';
