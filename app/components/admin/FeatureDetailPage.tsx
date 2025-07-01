"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { DataTable } from '../ui/data-table';
import { Checkbox } from '../ui/checkbox';
import {
  ArrowLeft,
  Users,
  History,
  Info,
  Calendar,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Filter,
  AlertTriangle,
  X
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { doc, getDoc, setDoc, collection, getDocs, query, where, orderBy, limit, updateDoc, arrayUnion, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useToast } from '../ui/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

// Define the feature interface
interface Feature {
  id: string;
  enabled: boolean;
  createdAt: string;
  lastModified: string;
  description: string;
  name?: string;
}

// Define the user interface for the table
interface UserFeature {
  id: string;
  username: string;
  email: string;
  enabled: boolean;
  lastModified: string;
  overridden: boolean;
  selected?: boolean; // For batch operations
}

// Define the history entry interface
interface HistoryEntry {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  details: string;
  userId?: string;
}

interface FeatureDetailPageProps {
  feature: Feature;
}

export default function FeatureDetailPage({ feature }: FeatureDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { session } = useCurrentAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(feature.enabled);
  const [, sessions, setUsers] = useState<UserFeature[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserFeature[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filterEnabled, setFilterEnabled] = useState<boolean | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [exemptOverrides, setExemptOverrides] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [currentUserFeatureEnabled, setCurrentUserFeatureEnabled] = useState<boolean | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [batchActionDialogOpen, setBatchActionDialogOpen] = useState(false);
  const [batchActionEnabled, setBatchActionEnabled] = useState(true);

  // Use centralized feature flags hook for state validation
  const {
    featureFlags: centralFeatureFlags,
    validateState,
    getFeatureFlag,
    isLoading: centralLoading
  } = useFeatureFlags();

  const [stateValidationWarning, setStateValidationWarning] = useState<string | null>(null);

  // Format the feature name for display
  const formatFeatureName = (id: string): string => {
    return feature.name || id.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Validate state consistency between local and central state
  useEffect(() => {
    const checkStateConsistency = async () => {
      if (centralLoading) return;

      try {
        // Get the current feature from central state
        const centralFeature = getFeatureFlag(feature.id);

        if (centralFeature) {
          // Check if local state matches central state
          if (globalEnabled !== centralFeature.enabled) {
            console.log(`[FeatureDetailPage] State mismatch detected for ${feature.id}:`);
            console.log(`  Local state: ${globalEnabled}`);
            console.log(`  Central state: ${centralFeature.enabled}`);

            setStateValidationWarning(
              `State inconsistency detected: This page shows "${globalEnabled ? 'enabled' : 'disabled'}" but the main dashboard shows "${centralFeature.enabled ? 'enabled' : 'disabled'}". Please refresh the page to sync the latest state.`
            );

            // Auto-sync to central state
            setGlobalEnabled(centralFeature.enabled);
          } else {
            // States match, clear any warning
            setStateValidationWarning(null);
          }
        } else {
          setStateValidationWarning(
            `Feature "${feature.id}" not found in central state. This may indicate a configuration issue.`
          );
        }

        // Also validate against database state
        const isStateValid = await validateState();
        if (!isStateValid) {
          console.log(`[FeatureDetailPage] Database state validation failed for ${feature.id}`);
        }
      } catch (error) {
        console.error('[FeatureDetailPage] Error validating state:', error);
      }
    };

    checkStateConsistency();
  }, [feature.id, globalEnabled, centralFeatureFlags, centralLoading, getFeatureFlag, validateState]);

  // Check if the current user has this feature enabled
  useEffect(() => {
    const checkCurrentUserFeature = async () => {
      if (!session) return;

      try {
        // Check if there's a user-specific override
        const featureOverrideRef = doc(db, 'featureOverrides', `${session.uid}_${feature.id}`);
        const featureOverrideDoc = await getDoc(featureOverrideRef);

        if (featureOverrideDoc.exists()) {
          const data = featureOverrideDoc.data();
          setCurrentUserFeatureEnabled(data.enabled);
        } else {
          // If no override, use the global setting
          setCurrentUserFeatureEnabled(globalEnabled);
        }
      } catch (error) {
        console.error('Error checking current user feature status:', error);
        setCurrentUserFeatureEnabled(globalEnabled); // Fall back to global setting
      }
    };

    checkCurrentUserFeature();
  }, [, session, feature.id, globalEnabled]);

  // Load users with their feature status
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoadingUsers(true);

        // Get all users
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);

        // Get user-specific feature overrides
        const featureOverridesRef = collection(db, 'featureOverrides');
        const featureOverridesQuery = query(
          featureOverridesRef,
          where('featureId', '==', feature.id)
        );
        const overridesSnapshot = await getDocs(featureOverridesQuery);

        // Create a map of user IDs to their feature override
        const overridesMap = new Map();
        overridesSnapshot.forEach(doc => {
          const data = doc.data();
          overridesMap.set(data.userId, {
            enabled: data.enabled,
            lastModified: data.lastModified
          });
        });

        // Process users
        const usersList: UserFeature[] = [];
        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          const override = overridesMap.get(doc.id);

          usersList.push({
            id: doc.id,
            username: userData.username || 'No username',
            email: userData.email || 'No email',
            enabled: override ? override.enabled : globalEnabled,
            lastModified: override ? override.lastModified : feature.lastModified,
            overridden: !!override,
            selected: false
          });
        });

        setUsers(usersList);
        setFilteredUsers(usersList);
      } catch (error) {
        console.error('Error loading users:', error);
        toast({
          title: 'Error',
          description: 'Failed to load users',
          variant: 'destructive'
        });
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, [feature.id, feature.lastModified, globalEnabled, toast]);

  // Load feature history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoadingHistory(true);

        // Get feature history
        const historyRef = collection(db, 'featureHistory');
        const historyQuery = query(
          historyRef,
          where('featureId', '==', feature.id),
          orderBy('timestamp', 'desc'),
          limit(50)
        );

        const historySnapshot = await getDocs(historyQuery);

        const historyList: HistoryEntry[] = [];
        historySnapshot.forEach(doc => {
          const data = doc.data();
          historyList.push({
            id: doc.id,
            timestamp: data.timestamp.toDate().toISOString(),
            adminEmail: data.adminEmail,
            action: data.action,
            details: data.details
          });
        });

        setHistory(historyList);
      } catch (error) {
        console.error('Error loading history:', error);
        toast({
          title: 'Error',
          description: 'Failed to load feature history',
          variant: 'destructive'
        });
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [feature.id, toast]);

  // Filter users based on feature status
  useEffect(() => {
    if (filterEnabled === null) {
      setFilteredUsers(users);
    } else {
      setFilteredUsers(users.filter(user => user.enabled === filterEnabled));
    }
  }, [filterEnabled, sessions]);

  // Toggle global feature status
  const toggleGlobalFeature = async () => {
    setConfirmDialogOpen(true);
  };

  // Confirm global feature toggle
  const confirmGlobalToggle = async () => {
    try {
      setIsLoading(true);

      // Update feature flag in Firestore
      const featureFlagsRef = doc(db, 'config', 'featureFlags');
      await updateDoc(featureFlagsRef, {
        [feature.id]: !globalEnabled
      });

      // Update feature metadata
      const featureMetaRef = doc(db, 'config', 'featureMetadata');
      const featureMetaDoc = await getDoc(featureMetaRef);

      if (featureMetaDoc.exists()) {
        await updateDoc(featureMetaRef, {
          [`${feature.id}.lastModified`]: new Date().toISOString()
        });
      } else {
        await setDoc(featureMetaRef, {
          [feature.id]: {
            createdAt: feature.createdAt,
            lastModified: new Date().toISOString(),
            description: feature.description
          }
        });
      }

      // Record history
      const historyRef = collection(db, 'featureHistory');
      await setDoc(doc(historyRef), {
        featureId: feature.id,
        timestamp: serverTimestamp(),
        adminEmail: localStorage.getItem('userEmail') || 'unknown',
        action: !globalEnabled ? 'enabled' : 'disabled',
        details: `Global feature ${!globalEnabled ? 'enabled' : 'disabled'} ${exemptOverrides ? 'with exemptions for user overrides' : 'for all users'}`
      });

      // If not exempting overrides, update all user overrides
      if (!exemptOverrides) {
        // Get all user overrides for this feature
        const featureOverridesRef = collection(db, 'featureOverrides');
        const featureOverridesQuery = query(
          featureOverridesRef,
          where('featureId', '==', feature.id)
        );
        const overridesSnapshot = await getDocs(featureOverridesQuery);

        // Update each override
        const batch = (db as any).batch();
        overridesSnapshot.forEach(doc => {
          batch.update(doc.ref, {
            enabled: !globalEnabled,
            lastModified: new Date().toISOString()
          });
        });

        await batch.commit();
      }

      // Update local state
      setGlobalEnabled(!globalEnabled);

      toast({
        title: 'Success',
        description: `Feature ${!globalEnabled ? 'enabled' : 'disabled'} successfully`});

      // Refresh the page to get updated data
      router.refresh();
    } catch (error) {
      console.error('Error toggling feature:', error);
      toast({
        title: 'Error',
        description: 'Failed to update feature status',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setConfirmDialogOpen(false);
    }
  };

  // Toggle feature for the current user
  const toggleCurrentUserFeature = async () => {
    if (!session) return;

    try {
      setIsLoading(true);
      const newStatus = !currentUserFeatureEnabled;

      // Update user-specific feature override
      const featureOverrideRef = doc(db, 'featureOverrides', `${session.uid}_${feature.id}`);

      await setDoc(featureOverrideRef, {
        userId: session.uid,
        featureId: feature.id,
        enabled: newStatus,
        lastModified: new Date().toISOString()
      });

      // Record history
      const historyRef = collection(db, 'featureHistory');
      await setDoc(doc(historyRef), {
        featureId: feature.id,
        userId: session.uid,
        timestamp: serverTimestamp(),
        adminEmail: session.email || 'unknown',
        action: newStatus ? 'enabled_for_self' : 'disabled_for_self',
        details: `Feature ${newStatus ? 'enabled' : 'disabled'} for self (${session.email})`
      });

      // Update local state
      setCurrentUserFeatureEnabled(newStatus);

      // Also update in the users list if present
      setUsers(users.map(u =>
        u.id === session.uid
          ? {
              ...u,
              enabled: newStatus,
              lastModified: new Date().toISOString(),
              overridden: true
            }
          : u
      ));

      toast({
        title: 'Success',
        description: `Feature ${newStatus ? 'enabled' : 'disabled'} for your account`});
    } catch (error) {
      console.error('Error toggling current user feature:', error);
      toast({
        title: 'Error',
        description: 'Failed to update your feature status',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle feature for a specific user
  const toggleUserFeature = async (userId: string, currentStatus: boolean) => {
    try {
      setIsLoading(true);
      // Update user-specific feature override
      const featureOverrideRef = doc(db, 'featureOverrides', `${userId}_${feature.id}`);

      await setDoc(featureOverrideRef, {
        userId,
        featureId: feature.id,
        enabled: !currentStatus,
        lastModified: new Date().toISOString()
      });

      // Record history
      const historyRef = collection(db, 'featureHistory');
      await setDoc(doc(historyRef), {
        featureId: feature.id,
        userId,
        timestamp: serverTimestamp(),
        adminEmail: session?.email || localStorage.getItem('userEmail') || 'unknown',
        action: !currentStatus ? 'enabled_for_user' : 'disabled_for_user',
        details: `Feature ${!currentStatus ? 'enabled' : 'disabled'} for user ${userId}`
      });

      // Update local state
      setUsers(users.map(user =>
        user.id === userId
          ? {
              ...user,
              enabled: !currentStatus,
              lastModified: new Date().toISOString(),
              overridden: true
            }
          : user
      ));

      toast({
        title: 'Success',
        description: `Feature ${!currentStatus ? 'enabled' : 'disabled'} for user`});
    } catch (error) {
      console.error('Error toggling user feature:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user feature status',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle selection for a user (for batch operations)
  const toggleUserSelection = (userId: string) => {
    setUsers(users.map(user =>
      user.id === userId
        ? { ...user, selected: !session.selected }
        : user
    ));

    // Update selectedUsers array
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, sessionId];
      }
    });
  };

  // Apply batch action to selected users
  const applyBatchAction = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setIsLoading(true);

      // Create a batch for Firestore operations
      const batch = (db as any).batch();

      // Process each selected user
      for (const userId of selectedUsers) {
        const featureOverrideRef = doc(db, 'featureOverrides', `${userId}_${feature.id}`);

        batch.set(featureOverrideRef, {
          userId,
          featureId: feature.id,
          enabled: batchActionEnabled,
          lastModified: new Date().toISOString()
        });
      }

      // Commit the batch
      await batch.commit();

      // Record history
      const historyRef = collection(db, 'featureHistory');
      await setDoc(doc(historyRef), {
        featureId: feature.id,
        timestamp: serverTimestamp(),
        adminEmail: session?.email || localStorage.getItem('userEmail') || 'unknown',
        action: batchActionEnabled ? 'batch_enabled' : 'batch_disabled',
        details: `Feature ${batchActionEnabled ? 'enabled' : 'disabled'} for ${selectedUsers.length} users in batch operation`
      });

      // Update local state
      setUsers(users.map(user =>
        selectedUsers.includes(user.id)
          ? {
              ...user,
              enabled: batchActionEnabled,
              lastModified: new Date().toISOString(),
              overridden: true,
              selected: false
            }
          : user
      ));

      // Clear selection
      setSelectedUsers([]);

      toast({
        title: 'Success',
        description: `Feature ${batchActionEnabled ? 'enabled' : 'disabled'} for ${selectedUsers.length} users`});

      // Close the dialog
      setBatchActionDialogOpen(false);
    } catch (error) {
      console.error('Error applying batch action:', error);
      toast({
        title: 'Error',
        description: 'Failed to update users in batch',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Define columns for the users table
  const columns: ColumnDef<UserFeature>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getFilteredSelectedRowModel().rows.length > 0 &&
            table.getFilteredSelectedRowModel().rows.length === table.getFilteredRowModel().rows.length
          }
          onCheckedChange={(value) => {
            // Select or deselect all rows
            const newSelectedUsers = value
              ? table.getFilteredRowModel().rows.map(row => row.original.id)
              : [];

            // Update selectedUsers state
            setSelectedUsers(newSelectedUsers);

            // Update selected state in users array
            setUsers(users.map(user => ({
              ...user,
              selected: value ? newSelectedUsers.includes(user.id) : false
            })));
          }}
          aria-label="Select all"
          className="ml-1"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.original.selected || false}
          onCheckedChange={() => toggleUserSelection(row.original.id)}
          aria-label="Select row"
          className="ml-1"
        />
      ),
      enableSorting: false,
      enableHiding: false},
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.username}</div>
      )},
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <div>{row.original.email}</div>},
    {
      accessorKey: "enabled",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center">
          {row.original.enabled ? (
            <Badge className="bg-success text-success-foreground">Enabled</Badge>
          ) : (
            <Badge variant="outline">Disabled</Badge>
          )}
          {row.original.overridden && (
            <Badge variant="outline" className="ml-2">Custom</Badge>
          )}
        </div>
      )},
    {
      accessorKey: "lastModified",
      header: "Last Modified",
      cell: ({ row }) => (
        <div title={format(new Date(row.original.lastModified), 'PPpp')}>
          {formatDistanceToNow(new Date(row.original.lastModified), { addSuffix: true })}
        </div>
      )},
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Switch
            checked={row.original.enabled}
            onCheckedChange={() => toggleUserFeature(row.original.id, row.original.enabled)}
          />
        </div>
      )},
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <Link href="/admin/tools" passHref>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Button>
        </Link>
      </div>

      {/* Feature header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-card rounded-2xl border-theme-medium">
        <div>
          <h1 className="text-2xl font-bold">{formatFeatureName(feature.id)}</h1>
          <p className="text-muted-foreground mt-1">{feature.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={globalEnabled ? "default" : "outline"} className="text-xs">
              {globalEnabled ? "Enabled" : "Disabled"}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              Created {formatDistanceToNow(new Date(feature.createdAt), { addSuffix: true })}
            </span>
            <span className="text-xs text-muted-foreground flex items-center">
              <RefreshCw className="h-3 w-3 mr-1" />
              Updated {formatDistanceToNow(new Date(feature.lastModified), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Global Status:</span>
            <Switch
              checked={globalEnabled}
              onCheckedChange={toggleGlobalFeature}
              disabled={isLoading}
            />
          </div>
          {session && currentUserFeatureEnabled !== null && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Your Access:</span>
              <Switch
                checked={!!currentUserFeatureEnabled}
                onCheckedChange={toggleCurrentUserFeature}
                disabled={isLoading}
              />
            </div>
          )}
        </div>
      </div>

      {/* State Validation Warning */}
      {stateValidationWarning && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  State Synchronization Warning
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  {stateValidationWarning}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Page
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStateValidationWarning(null)}
                    className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/20"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for different sections */}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full md:w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature Details</CardTitle>
              <CardDescription>
                Detailed information about this feature flag
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Feature ID</h3>
                  <p className="text-sm text-muted-foreground">{feature.id}</p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Global Status</h3>
                  <div className="flex items-center">
                    {globalEnabled ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground mr-2" />
                    )}
                    <span>{globalEnabled ? "Enabled" : "Disabled"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Created</h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(feature.createdAt), 'PPpp')}
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Last Modified</h3>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(feature.lastModified), 'PPpp')}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Description</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={() => setActiveTab('users')}
                className="w-full"
              >
                <Users className="h-4 w-4 mr-2" />
                Manage User Access
              </Button>
            </CardFooter>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>User Access</CardTitle>
                <CardDescription>
                  Summary of user access to this feature
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Users</span>
                    <span className="font-medium">{users.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Users with Access</span>
                    <span className="font-medium">{users.filter(u => u.enabled).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Custom Overrides</span>
                    <span className="font-medium">{users.filter(u => u.overridden).length}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('users')}
                  className="w-full"
                >
                  View All Users
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Recent changes to this feature
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loadingHistory ? (
                    <div className="text-center py-4">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                      <p className="text-sm text-muted-foreground mt-2">Loading history...</p>
                    </div>
                  ) : history.length > 0 ? (
                    history.slice(0, 3).map((entry) => (
                      <div key={entry.id} className="border-b pb-2 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {entry.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          by {entry.adminEmail}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No history available
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('history')}
                  className="w-full"
                >
                  View Full History
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage which users have access to this feature
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Button
                    variant={filterEnabled === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterEnabled(null)}
                  >
                    All
                  </Button>
                  <Button
                    variant={filterEnabled === true ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterEnabled(true)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Enabled
                  </Button>
                  <Button
                    variant={filterEnabled === false ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterEnabled(false)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Disabled
                  </Button>
                </div>

                {selectedUsers.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">
                      {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBatchActionDialogOpen(true)}
                    >
                      Batch Actions
                    </Button>
                  </div>
                )}
              </div>

              {loadingUsers ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
                  <p className="text-muted-foreground mt-4">Loading users...</p>
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={filteredUsers}
                  searchKey="username"
                  searchPlaceholder="Search users..."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature History</CardTitle>
              <CardDescription>
                History of changes to this feature
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
                  <p className="text-muted-foreground mt-4">Loading history...</p>
                </div>
              ) : history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((entry) => (
                    <div key={entry.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(entry.timestamp), 'PPpp')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        by {entry.adminEmail}
                      </p>
                      {entry.details && (
                        <p className="text-sm mt-2">{entry.details}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-4">No history available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog for Global Toggle */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {globalEnabled ? 'Disable' : 'Enable'} Feature
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {globalEnabled ? 'disable' : 'enable'} the {formatFeatureName(feature.id)} feature?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="exempt-overrides"
                checked={exemptOverrides}
                onCheckedChange={setExemptOverrides}
              />
              <label htmlFor="exempt-overrides" className="text-sm">
                Preserve user-specific overrides
              </label>
            </div>

            <div className="text-sm text-muted-foreground">
              {exemptOverrides
                ? "Users with custom settings will keep their current access level."
                : "All users will be affected by this change, overriding any custom settings."}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant={globalEnabled ? "destructive" : "default"}
              onClick={confirmGlobalToggle}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {globalEnabled ? 'Disable' : 'Enable'} Feature
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Action Dialog */}
      <Dialog open={batchActionDialogOpen} onOpenChange={setBatchActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Batch Action for {selectedUsers.length} Users
            </DialogTitle>
            <DialogDescription>
              Apply feature access change to all selected users
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Set feature status:</span>
              <div className="flex items-center gap-4">
                <Button
                  variant={batchActionEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBatchActionEnabled(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Enable
                </Button>
                <Button
                  variant={!batchActionEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBatchActionEnabled(false)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Disable
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              This will {batchActionEnabled ? 'enable' : 'disable'} the {formatFeatureName(feature.id)} feature for {selectedUsers.length} selected users.
              This action will override any existing user-specific settings.
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBatchActionDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={applyBatchAction}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Apply to {selectedUsers.length} Users
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}