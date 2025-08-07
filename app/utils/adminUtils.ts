/**
 * Admin utilities for checking user permissions
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getCollectionName } from './environmentConfig';

// List of admin user IDs - in production, this should be stored in environment variables
const ADMIN_USER_IDS = [
  // Add admin user IDs here
  process.env.ADMIN_USER_ID_1,
  process.env.ADMIN_USER_ID_2,
  // Fallback for development
  'admin-user-id-placeholder'
].filter(Boolean);

/**
 * Check if a user has admin privileges
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    // Check if user ID is in the admin list
    if (ADMIN_USER_IDS.includes(userId)) {
      return true;
    }

    // Check if user has admin role in Firestore
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
