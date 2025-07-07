/**
 * WeWrite Admin Panel - User Management Component
 *
 * This component provides comprehensive user management functionality for WeWrite administrators.
 * It displays user information in a full-width table layout with feature flag management capabilities.
 *
 * Key Features:
 * - User listing with email verification status from Firebase Auth
 * - Feature flag override management per user
 * - Search and filtering capabilities
 * - Real-time data loading with error handling
 * - Responsive design with mobile optimization
 *
 * Technical Implementation:
 * - Fetches user data from Firestore users collection
 * - Retrieves email verification status from Firebase Auth
 * - Manages feature flag overrides in featureOverrides collection
 * - Uses three-state logic for feature flags: Global/Enabled/Disabled
 *
 * Database Schema:
 * - users/{userId}: Basic user profile data
 * - featureOverrides/{userId}_{flagName}: User-specific feature flag overrides
 *
 * @author WeWrite Development Team
 * @version 2.0.0
 */

"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Search, Mail, MailCheck, Clock, RefreshCw, Check, X, AlertTriangle } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { auth } from '../../firebase/auth';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Alert, AlertDescription } from '../ui/alert';

/**
 * Available feature flags in the WeWrite application
 * These flags control access to various features and can be overridden per user
 */
const FEATURE_FLAGS = [
  'payments',           // Subscription and payment functionality (includes token system)
  'map_view',          // Geographic visualization features
  'calendar_view',     // Temporal organization and calendar features
] as const;

type FeatureFlagKey = typeof FEATURE_FLAGS[number];

/**
 * User data interface for admin panel display
 * Combines data from Firestore users collection and Firebase Auth
 */
interface UserData {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
  emailVerified?: boolean;  // Fetched from Firebase Auth, not Firestore
  createdAt?: string;
  lastLogin?: string;
  queueCount?: number;
  featureFlags?: Record<FeatureFlagKey, boolean | null>; // null = using global default
}

/**
 * Error state interface for user-friendly error display
 */
interface ErrorState {
  hasError: boolean;
  message: string;
  details?: string;
}

/**
 * Main UserManagement component for WeWrite admin panel
 *
 * Provides comprehensive user management with feature flag controls.
 * Handles data loading, error states, and user interactions.
 */
export function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [error, setError] = useState<ErrorState>({ hasError: false, message: '' });

  /**
   * Sync email verification status from Firebase Auth to Firestore
   *
   * This function attempts to update Firestore user documents with the current
   * email verification status from Firebase Auth. This is needed because the
   * admin panel reads from Firestore but email verification is stored in Auth.
   *
   * Note: This is a workaround for the limitation that client-side code cannot
   * directly access other users' Firebase Auth data. In production, this should
   * be handled by a server-side Cloud Function.
   */
  const syncEmailVerificationStatus = async () => {
    try {
      console.log('Syncing email verification status from Firebase Auth to Firestore...');

      // Get current user's verification status (we can only access our own)
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
          emailVerified: currentUser.emailVerified,
          lastEmailVerificationSync: new Date().toISOString()
        }, { merge: true });

        console.log(`Synced email verification for current user: ${currentUser.emailVerified}`);
      }

      // For other users, we would need a server-side function
      // This is a limitation of Firebase Auth security rules

    } catch (error) {
      console.error('Error syncing email verification status:', error);
    }
  };

  /**
   * Load users from Firestore with feature flag overrides and Firebase Auth email verification status
   *
   * This function performs the following operations:
   * 1. Fetches user documents from Firestore users collection
   * 2. For each user, attempts to get email verification status from Firebase Auth
   * 3. Loads feature flag overrides from featureOverrides collection
   * 4. Handles errors gracefully with detailed logging and user feedback
   *
   * Error Handling:
   * - Firestore connection failures
   * - Missing user data fields
   * - Firebase Auth access issues
   * - Feature flag loading errors
   */
  const loadUsers = async () => {
    setLoading(true);
    setError({ hasError: false, message: '' });

    try {
      console.log('Loading users from API...');

      // First, sync current user's email verification status
      await syncEmailVerificationStatus();

      // Call the admin users API endpoint
      const response = await fetch('/api/admin/users?limit=100', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load users');
      }

      console.log(`Successfully loaded ${data.users.length} users from API`);

      // Add queue count for compatibility (TODO: implement in API)
      const usersWithQueueCount = data.users.map((user: UserData) => ({
        ...user,
        queueCount: 0 // Default to 0 for now
      }));

      setUsers(usersWithQueueCount);
      setFilteredUsers(usersWithQueueCount);

    } catch (error: any) {
      console.error('Error loading users:', error);

      // Provide specific error messages based on error type
      let errorMessage = 'Failed to load user data';
      let errorDetails = '';

      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = 'Authentication required';
        errorDetails = 'Please ensure you are logged in with admin privileges';
      } else if (error.message?.includes('403') || error.message?.includes('Admin access required')) {
        errorMessage = 'Permission denied accessing user data';
        errorDetails = 'You may not have sufficient privileges to access the users collection';
      } else if (error.message?.includes('500')) {
        errorMessage = 'Server error occurred';
        errorDetails = 'The server encountered an error while loading user data. Please try again later.';
      } else if (error.message) {
        errorDetails = error.message;
      }

      setError({
        hasError: true,
        message: errorMessage,
        details: errorDetails
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filter users based on search term
   * Searches across email, username, and display name fields
   * Updates filteredUsers state whenever searchTerm or users array changes
   */
  useEffect(() => {
    // Ensure users is an array before filtering
    const safeUsers = Array.isArray(users) ? users : [];

    if (!searchTerm) {
      setFilteredUsers(safeUsers);
    } else {
      const filtered = safeUsers.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  /**
   * Toggle feature flag for a specific user
   *
   * Implements three-state logic:
   * - null (Global) → true (Enabled override)
   * - true (Enabled) → false (Disabled override)
   * - false (Disabled) → null (Global default)
   *
   * @param userId - The user's unique identifier
   * @param flag - The feature flag to toggle
   * @param currentValue - Current state: null=global, true=enabled, false=disabled
   */
  const toggleUserFeatureFlag = async (userId: string, flag: FeatureFlagKey, currentValue: boolean | null) => {
    try {
      console.log(`Toggling feature flag ${flag} for user ${userId} from ${currentValue}`);

      let newValue: boolean | null;
      if (currentValue === null) {
        // Currently using global default, set to enabled override
        newValue = true;
      } else if (currentValue === true) {
        // Currently enabled, set to disabled override
        newValue = false;
      } else {
        // Currently disabled, remove override (use global default)
        newValue = null;
      }

      // Call the admin users API endpoint to update feature flag
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUserId: userId,
          featureId: flag,
          enabled: newValue
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update feature flag');
      }

      console.log(`Successfully updated ${flag} for user ${userId} to ${newValue}`);

      // Reload users to reflect changes
      await loadUsers();
    } catch (error: any) {
      console.error(`Error toggling feature flag ${flag} for user ${userId}:`, error);

      // Show user-friendly error message
      let errorMessage = `Failed to update ${flag} setting`;
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = 'Authentication required: Please log in again';
      } else if (error.message?.includes('403') || error.message?.includes('Admin access required')) {
        errorMessage = 'Permission denied: Cannot modify feature flags';
      } else if (error.message?.includes('500')) {
        errorMessage = 'Server error: Please try again later';
      }

      setError({
        hasError: true,
        message: errorMessage,
        details: error.message || 'Unknown error occurred'
      });
    }
  };

  /**
   * Load users on component mount
   * Automatically fetches user data when component is first rendered
   */
  useEffect(() => {
    loadUsers();
  }, []);

  /**
   * Generate email verification status badge
   *
   * @param emailVerified - Boolean indicating if user's email is verified in Firebase Auth
   * @returns JSX badge component with appropriate styling and icon
   */
  const getVerificationBadge = (emailVerified: boolean) => {
    if (emailVerified) {
      return (
        <Badge variant="default" className="bg-success/10 text-success dark:bg-success/20 dark:text-success-foreground">
          <MailCheck className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        <Mail className="h-3 w-3 mr-1" />
        Unverified
      </Badge>
    );
  };

  /**
   * Generate sync queue status badge
   *
   * @param queueCount - Number of items in user's sync queue
   * @returns JSX badge component or null if queue is empty
   */
  const getQueueBadge = (queueCount: number) => {
    if (queueCount === 0) {
      return null;
    }
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
        <Clock className="h-3 w-3 mr-1" />
        {queueCount} queued
      </Badge>
    );
  };

  /**
   * Format date string for display
   *
   * @param dateString - ISO date string or undefined
   * @returns Formatted date string or fallback text
   */
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Invalid date';
    }
  };

  /**
   * Render feature flag cell with interactive toggle button
   *
   * Displays current state and allows toggling between three states:
   * - G (Global): Using system default
   * - ✓ (Check): User override enabled
   * - ✗ (X): User override disabled
   *
   * @param user - User data object
   * @param flag - Feature flag key
   * @returns JSX table cell with interactive button
   */
  const renderFeatureFlagCell = (user: UserData, flag: FeatureFlagKey) => {
    const value = user.featureFlags?.[flag];

    /**
     * Generate tooltip text explaining current state
     */
    const getTooltipText = () => {
      if (value === null) return `Using global default for ${flag}`;
      return `${flag} is ${value ? 'enabled' : 'disabled'} for this user`;
    };

    return (
      <TableCell key={flag} className="text-center">
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 hover:bg-muted/50 ${
            value === null
              ? 'text-muted-foreground'
              : value
                ? 'text-success hover:text-success/80'
                : 'text-destructive hover:text-destructive/80'
          }`}
          onClick={() => toggleUserFeatureFlag(user.uid, flag, value ?? null)}
          disabled={loading}
          title={getTooltipText()}
        >
          {value === null ? (
            <span className="text-xs font-medium">G</span>
          ) : value ? (
            <Check className="h-4 w-4" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </TableCell>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">
            Manage users, email verification status, and feature flag overrides
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadUsers}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error.hasError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">{error.message}</p>
              {error.details && (
                <p className="text-sm opacity-90">{error.details}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users by email, username, or display name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* User Statistics and Legend */}
      <div className="flex flex-wrap gap-6 items-start">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-xl font-bold">{Array.isArray(users) ? users.length : 0}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-xl font-bold text-success">
              {Array.isArray(users) ? users.filter(u => u.emailVerified).length : 0}
            </p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-xl font-bold text-amber-600">
              {Array.isArray(users) ? users.filter(u => !u.emailVerified).length : 0}
            </p>
            <p className="text-xs text-muted-foreground">Unverified</p>
          </div>
        </div>

        {/* Feature Flag Legend */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium mb-2">Feature Flag States:</p>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 text-success" />
              <span>Enabled</span>
            </div>
            <div className="flex items-center gap-1">
              <X className="h-3 w-3 text-destructive" />
              <span>Disabled</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs font-medium border rounded px-1">G</span>
              <span>Using Global Default</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Click to toggle user-specific overrides</p>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading users...</span>
        </div>
      ) : (
        <div className="w-full border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Email</TableHead>
                <TableHead className="w-[120px]">Username</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]">Queue</TableHead>
                <TableHead className="w-[120px]">Joined</TableHead>
                {FEATURE_FLAGS.map(flag => (
                  <TableHead key={flag} className="w-[80px] text-center">
                    {flag.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((session) => (
                <TableRow key={session.uid} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="truncate max-w-[180px]" title={session.email}>
                      {session.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {session.username ? (
                      <span className="text-sm">@{session.username}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getVerificationBadge(session.emailVerified || false)}
                  </TableCell>
                  <TableCell>
                    {session.queueCount !== undefined && getQueueBadge(session.queueCount)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(session.createdAt)}
                  </TableCell>
                  {FEATURE_FLAGS.map(flag => renderFeatureFlagCell(session, flag))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              {searchTerm ? 'No users found matching your search.' : 'No users found.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}