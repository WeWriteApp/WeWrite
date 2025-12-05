/**
 * Admin utilities for checking user permissions
 * 
 * SECURITY NOTE:
 * - In development: ALL users have admin access, but ONLY to DEV_ collections
 * - In production: Only production admin users have access
 * - Admin tools automatically use the correct collection prefix based on environment
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCollectionName, getEnvironmentType } from './environmentConfig';

// Production admin user IDs - these have access to production data
const PRODUCTION_ADMIN_USER_IDS = [
  process.env.ADMIN_USER_ID_1,
  process.env.ADMIN_USER_ID_2,
].filter(Boolean) as string[];

/**
 * Check if a user has admin privileges
 * 
 * In development: ALL users are admins (scoped to dev collections only)
 * In production: Only production admin users have access
 * 
 * This allows easy testing of admin features during development
 * without needing to manually configure each test account.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    // Check if user ID is in the production admin list
    if (PRODUCTION_ADMIN_USER_IDS.includes(userId)) {
      return true;
    }

    // In development, ALL users are admins (but scoped to DEV_ collections)
    const envType = getEnvironmentType();
    if (envType === 'development') {
      return true;
    }

    // Check if user has admin role in Firestore (uses environment-specific collection)
    const userDoc = await getDoc(doc(db, getCollectionName('users'), userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.role === 'admin' || userData.isAdmin === true;
    }

    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if user is a production admin (can access production data)
 */
export async function isProductionAdminUser(userId: string): Promise<boolean> {
  try {
    if (PRODUCTION_ADMIN_USER_IDS.includes(userId)) {
      return true;
    }

    // Check Firestore for production admin flag
    const userDoc = await getDoc(doc(db, 'users', userId)); // Note: uses production 'users' collection
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.role === 'super_admin' || userData.isProductionAdmin === true;
    }

    return false;
  } catch (error) {
    console.error('Error checking production admin status:', error);
    return false;
  }
}

/**
 * Get admin user information
 */
export async function getAdminUserInfo(userId: string): Promise<{
  isAdmin: boolean;
  adminLevel?: 'super' | 'standard';
  permissions?: string[];
} | null> {
  try {
    const userDoc = await getDoc(doc(db, getCollectionName('users'), userId));
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    const isAdmin = await isAdminUser(userId);

    if (!isAdmin) {
      return { isAdmin: false };
    }

    return {
      isAdmin: true,
      adminLevel: userData.adminLevel || 'standard',
      permissions: userData.adminPermissions || ['read', 'write']
    };
  } catch (error) {
    console.error('Error getting admin user info:', error);
    return null;
  }
}

/**
 * Check if user has specific admin permission
 */
export async function hasAdminPermission(userId: string, permission: string): Promise<boolean> {
  try {
    const adminInfo = await getAdminUserInfo(userId);
    if (!adminInfo?.isAdmin) {
      return false;
    }

    // Super admins have all permissions
    if (adminInfo.adminLevel === 'super') {
      return true;
    }

    // Check specific permission
    return adminInfo.permissions?.includes(permission) || false;
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}
