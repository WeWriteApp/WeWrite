/**
 * WeWrite Admin Panel - User Management Component
 *
 * This component provides comprehensive user management functionality for WeWrite administrators.
 * It displays user information in a full-width table layout optimized for mobile and desktop.
 *
 * Key Features:
 * - User listing with email verification status from Firebase Auth
 * - Search and filtering capabilities
 * - Real-time data loading with error handling
 * - Responsive design with mobile optimization
 *
 * Technical Implementation:
 * - Fetches user data from Firestore users collection
 * - Retrieves email verification status from Firebase Auth
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
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
// Using API endpoints instead of direct Firebase calls
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Alert, AlertDescription } from '../ui/alert';


// Feature flags have been removed

/**
 * User data interface for admin panel display
 * Combines data from Firestore users collection and Firebase Auth
 */
interface UserData {
  uid: string;
  email: string;
  username?: string;
  // displayName removed - fully deprecated, only use username
  emailVerified?: boolean;  // Fetched from Firebase Auth, not Firestore
  createdAt?: string;
  lastLogin?: string;
  // Feature flags removed - all features are now always enabled
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

      // Get current user's verification status (we can only access our own)
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
          emailVerified: currentUser.emailVerified,
          lastEmailVerificationSync: new Date().toISOString()
        }, { merge: true });

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


      setUsers(data.users);
      setFilteredUsers(data.users);

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
        user.username?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  // Feature flag management removed - all features are now always enabled

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
          <Icon name="MailCheck" size={12} className="mr-1" />
          Verified
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
        <Icon name="Mail" size={12} className="mr-1" />
        Unverified
      </Badge>
    );
  };


  /**
   * Format date string for tooltip display (full date and time)
   *
   * @param dateString - ISO date string or undefined
   * @returns Formatted date string for tooltip or fallback text
   */
  const formatTooltipDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return format(date, 'PPpp'); // e.g., "Jan 1, 2024 at 12:00:00 PM"
    } catch {
      return 'Invalid date';
    }
  };

  // Feature flag cell rendering removed - all features are now always enabled

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">
            Manage users and email verification status
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadUsers}
          disabled={loading}
        >
          <Icon name="RefreshCw" size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error.hasError && (
        <Alert variant="destructive">
          <Icon name="AlertTriangle" size={16} />
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
      <Input
        placeholder="Search users by email, username, or display name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        leftIcon={<Icon name="Search" size={16} />}
        wrapperClassName="max-w-md"
      />

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
              <Icon name="Check" size={12} className="text-success" />
              <span>Enabled</span>
            </div>
            <div className="flex items-center gap-1">
              <Icon name="X" size={12} className="text-destructive" />
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
          <Icon name="Loader" size={24} className="text-muted-foreground mr-2" />
          <span>Loading users...</span>
        </div>
      ) : (
        <div className="w-full border rounded-lg overflow-x-auto table-container">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px] sm:w-[200px]">Email</TableHead>
                <TableHead className="min-w-[100px] sm:w-[120px]">Username</TableHead>
                <TableHead className="min-w-[80px] sm:w-[100px]">Status</TableHead>
                <TableHead className="min-w-[100px] sm:w-[120px]">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((session) => (
                <TableRow key={session.uid} className="hover:bg-muted/50 touch-manipulation">
                  <TableCell className="font-medium text-sm sm:text-base py-3 sm:py-4">
                    <div className="truncate max-w-[180px]" title={session.email}>
                      {session.email}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 sm:py-4">
                    {session.username ? (
                      <span className="text-sm">@{session.username}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 sm:py-4">
                    {getVerificationBadge(session.emailVerified || false)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground py-3 sm:py-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {session.createdAt ? (() => {
                              try {
                                return formatRelativeTime(session.createdAt);
                              } catch (error) {
                                console.error('Error formatting user creation time:', error);
                                return 'Unknown';
                              }
                            })() : 'Unknown'}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{formatTooltipDate(session.createdAt)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
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

      {/* Mobile optimization styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .table-container {
            font-size: 14px;
          }

          .table-container th,
          .table-container td {
            padding: 8px 12px;
            min-height: 44px; /* Touch-friendly minimum height */
          }

          .table-container .truncate {
            max-width: 120px;
          }
        }

        @media (max-width: 480px) {
          .table-container {
            font-size: 13px;
          }

          .table-container th,
          .table-container td {
            padding: 6px 8px;
          }

          .table-container .truncate {
            max-width: 100px;
          }
        }
      `}</style>
    </div>
  );
}