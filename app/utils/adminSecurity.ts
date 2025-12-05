/**
 * Centralized Admin Security Module
 * 
 * This module provides secure, audited admin authorization for WeWrite.
 * All admin checks should go through this module to ensure consistency
 * and proper security logging.
 */

import { NextRequest } from 'next/server';
import { getUserIdFromRequest } from '../api/auth-helper';
import { getFirebaseAdmin } from '../firebase/admin';
import { getCollectionName, getEnvironmentType } from './environmentConfig';
import { DEV_TEST_USER_UIDS, DEV_TEST_USER_EMAILS } from './testUsers';

// SECURITY: Single source of truth for admin users
const ADMIN_USER_IDS = [
  'mP9yRa3nO6gS8wD4xE2hF5jK7m9N', // Jamie's admin user ID (dev_admin_user)
  'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L', // Current dev session user ID
  'jamie-admin-uid', // Legacy admin user ID
  // Add other admin user IDs here as needed
];

// SECURITY: Admin email addresses for verification
const ADMIN_EMAILS = [
  'jamiegray2234@gmail.com',
  'contact@jamiegray.net', // Jamie's primary email from GitHub
  'jamie@wewrite.app',
  'test1@wewrite.dev', // Current dev session email
  'test2@wewrite.dev', // Dev admin: testuser2
  // Add other admin emails here as needed
];

/**
 * Check if we're in development environment and the user is a dev test user
 * DEV USERS ARE AUTOMATICALLY ADMINS IN DEVELOPMENT MODE
 * This allows testing admin features without modifying production admin lists
 */
function isDevUserAdmin(userId: string | null, userEmail: string | null): boolean {
  const env = getEnvironmentType();
  if (env !== 'development') {
    return false; // Dev user admin access is ONLY for development environment
  }
  
  // Check by UID or email
  if (userId && DEV_TEST_USER_UIDS.includes(userId)) {
    return true;
  }
  if (userEmail && DEV_TEST_USER_EMAILS.includes(userEmail)) {
    return true;
  }
  
  return false;
}

export interface AdminAuthResult {
  isAdmin: boolean;
  userId: string | null;
  userEmail: string | null;
  auditId: string;
}

export interface SecurityAuditLog {
  auditId: string;
  action: string;
  userId: string | null;
  userEmail: string | null;
  success: boolean;
  timestamp: Date;
  ip: string | null;
  userAgent: string | null;
  route: string;
  method: string;
}

/**
 * Get client IP address from request headers
 */
function getClientIP(request: NextRequest): string | null {
  // Check various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return null;
}

/**
 * Generate unique audit ID for tracking
 */
function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log security audit event to database
 */
async function logSecurityAudit(auditLog: SecurityAuditLog): Promise<void> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      console.error('[SECURITY] Firebase Admin not available for audit logging');
      return;
    }
    
    const db = admin.firestore();
    
    // Store audit log in secure collection
    await db.collection(getCollectionName('security_audit_logs')).add({
      ...auditLog,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Also log to console for immediate monitoring
    console.log('[SECURITY AUDIT]', {
      auditId: auditLog.auditId,
      action: auditLog.action,
      success: auditLog.success,
      userId: auditLog.userId ? auditLog.userId.substring(0, 8) + '...' : null,
      route: auditLog.route,
      ip: auditLog.ip
    });
    
  } catch (error) {
    console.error('[SECURITY] Failed to log audit event:', error);
    // CRITICAL: Always log security events to console even if DB fails
    console.error('[SECURITY AUDIT FALLBACK]', auditLog);
  }
}

/**
 * Get user email from user ID
 */
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return null;
    }
    
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }
    
    return userDoc.data()?.email || null;
  } catch (error) {
    console.error('[SECURITY] Failed to get user email:', error);
    return null;
  }
}

/**
 * MAIN FUNCTION: Verify admin access with full security audit
 * 
 * This is the single source of truth for admin authorization.
 * All admin routes MUST use this function.
 */
export async function verifyAdminAccess(request: NextRequest): Promise<AdminAuthResult> {
  const auditId = generateAuditId();
  const route = new URL(request.url).pathname;
  const method = request.method;
  
  let userId: string | null = null;
  let userEmail: string | null = null;
  let isAdmin = false;
  
  try {
    // Get authenticated user ID
    userId = await getUserIdFromRequest(request);
    console.log('🔐 [ADMIN AUTH] User ID from request:', userId);

    if (!userId) {
      // Not authenticated - definitely not admin
      console.log('🔐 [ADMIN AUTH] No user ID found - not authenticated');
      await logSecurityAudit({
        auditId,
        action: 'admin_access_attempt',
        userId: null,
        userEmail: null,
        success: false,
        timestamp: new Date(),
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent'),
        route,
        method
      });

      return { isAdmin: false, userId: null, userEmail: null, auditId };
    }
    
    // Get user email for verification (Firestore first, then request header fallback)
    userEmail = await getUserEmail(userId);
    if (!userEmail) {
      // Middleware sets this from the session cookie; helps in dev where the user doc may be missing email
      userEmail = request.headers.get('x-user-email');
    }

    console.log('🔐 [ADMIN AUTH] User email (resolved):', userEmail);

    // Check admin status using both user ID and email for security
    const isAdminByUserId = ADMIN_USER_IDS.includes(userId);
    const isAdminByEmail = userEmail ? ADMIN_EMAILS.includes(userEmail) : false;
    const isDevAdmin = isDevUserAdmin(userId, userEmail);

    console.log('🔐 [ADMIN AUTH] Admin checks:', {
      userId,
      userEmail,
      isAdminByUserId,
      isAdminByEmail,
      isDevAdmin,
      environment: getEnvironmentType(),
      adminUserIds: ADMIN_USER_IDS,
      adminEmails: ADMIN_EMAILS
    });

    // SECURITY: Allow admin access by email, user ID, or dev user status (in development)
    isAdmin = isAdminByEmail || isAdminByUserId || isDevAdmin;

    // Log if user ID doesn't match but email does (for debugging)
    if (isAdminByEmail && !isAdminByUserId) {
      console.warn('🔐 [ADMIN AUTH] Admin email matched but user ID not in list. User ID:', userId);
      console.warn('🔐 [ADMIN AUTH] Consider adding this user ID to ADMIN_USER_IDS:', userId);
    }
    
    // Log the admin access attempt
    await logSecurityAudit({
      auditId,
      action: 'admin_access_attempt',
      userId,
      userEmail,
      success: isAdmin,
      timestamp: new Date(),
      ip: getClientIP(request),
      userAgent: request.headers.get('user-agent'),
      route,
      method
    });
    
    // SECURITY: Log failed admin attempts with more detail
    if (!isAdmin) {
      console.warn('[SECURITY] Unauthorized admin access attempt:', {
        auditId,
        userId: userId.substring(0, 8) + '...',
        userEmail: userEmail ? userEmail.replace(/(.{2}).*(@.*)/, '$1***$2') : null,
        route,
        ip: getClientIP(request)
      });
    }
    
    return { isAdmin, userId, userEmail, auditId };
    
  } catch (error) {
    console.error('[SECURITY] Error in admin verification:', error);
    
    // Log the error as a security event
    await logSecurityAudit({
      auditId,
      action: 'admin_access_error',
      userId,
      userEmail,
      success: false,
      timestamp: new Date(),
      ip: getClientIP(request),
      userAgent: request.headers.get('user-agent'),
      route,
      method
    });
    
    // SECURITY: Fail closed - deny access on any error
    return { isAdmin: false, userId, userEmail, auditId };
  }
}

/**
 * Simplified admin check for non-critical operations
 * Still uses the same security verification but with less logging
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    if (!userId) {
      return false;
    }
    
    const userEmail = await getUserEmail(userId);
    const isAdminByUserId = ADMIN_USER_IDS.includes(userId);
    const isAdminByEmail = userEmail ? ADMIN_EMAILS.includes(userEmail) : false;
    const isDevAdmin = isDevUserAdmin(userId, userEmail);

    // Allow admin by verified email, userId, or dev user status (in development)
    return isAdminByUserId || isAdminByEmail || isDevAdmin;
  } catch (error) {
    console.error('[SECURITY] Error in simple admin check:', error);
    return false;
  }
}

/**
 * Create standardized admin error response
 */
export function createAdminUnauthorizedResponse(auditId: string) {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized',
      message: 'Admin access required',
      auditId
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-Audit-ID': auditId
      }
    }
  );
}

/**
 * Middleware wrapper for admin routes
 */
export function withAdminAuth(handler: (request: NextRequest, adminAuth: AdminAuthResult) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const adminAuth = await verifyAdminAccess(request);
    
    if (!adminAuth.isAdmin) {
      return createAdminUnauthorizedResponse(adminAuth.auditId);
    }
    
    return handler(request, adminAuth);
  };
}
