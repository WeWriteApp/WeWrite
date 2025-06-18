"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Loader, 
  Search, 
  UserPlus, 
  UserMinus, 
  Users, 
  Shield,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { FeatureFlag } from '../../utils/feature-flags';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  setDoc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebase/database';
import { useToast } from '../ui/use-toast';
import { useAuth } from '../../providers/AuthProvider';

interface FeatureFlagState {
  id: FeatureFlag;
  name: string;
  description: string;
  enabled: boolean;
}

interface UserFeature {
  id: string;
  username: string;
  email: string;
  enabled: boolean;
  lastModified: string;
  overridden: boolean;
}

interface UserAccessModalProps {
  featureFlag: FeatureFlagState;
  isOpen: boolean;
  onClose: () => void;
  onUserStatsChange: () => void;
}

export default function UserAccessModal({
  featureFlag,
  isOpen,
  onClose,
  onUserStatsChange
}: UserAccessModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserFeature[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserFeature[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, featureFlag.id]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, activeTab]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);

      // Get all users
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);

      // Get user-specific feature overrides
      const featureOverridesRef = collection(db, 'featureOverrides');
      const featureOverridesQuery = query(
        featureOverridesRef,
        where('featureId', '==', featureFlag.id)
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

      // Build user list with feature status
      const userList: UserFeature[] = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const override = overridesMap.get(doc.id);
        
        // Determine effective access
        let effectiveAccess = featureFlag.enabled; // Default to global setting
        let isOverridden = false;
        
        if (override) {
          effectiveAccess = override.enabled;
          isOverridden = true;
        }

        userList.push({
          id: doc.id,
          username: userData.username || 'No username',
          email: userData.email || 'No email',
          enabled: effectiveAccess,
          lastModified: override?.lastModified || 'Never',
          overridden: isOverridden
        });
      });

      setUsers(userList);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    // Ensure users is an array before filtering
    const safeUsers = Array.isArray(users) ? users : [];
    let filtered = safeUsers;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by tab
    switch (activeTab) {
      case 'enabled':
        filtered = filtered.filter(user => user.enabled);
        break;
      case 'disabled':
        filtered = filtered.filter(user => !user.enabled);
        break;
      case 'overridden':
        filtered = filtered.filter(user => user.overridden);
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    setFilteredUsers(filtered);
  };

  const toggleUserAccess = async (userId: string, currentStatus: boolean) => {
    try {
      setIsLoading(true);
      const newStatus = !currentStatus;

      // Update user-specific feature override
      const featureOverrideRef = doc(db, 'featureOverrides', `${userId}_${featureFlag.id}`);

      await setDoc(featureOverrideRef, {
        userId,
        featureId: featureFlag.id,
        enabled: newStatus,
        lastModified: new Date().toISOString()
      });

      // Record history
      const historyRef = collection(db, 'featureHistory');
      await setDoc(doc(historyRef), {
        featureId: featureFlag.id,
        userId,
        timestamp: serverTimestamp(),
        adminEmail: user?.email || 'unknown',
        action: newStatus ? 'enabled_for_user' : 'disabled_for_user',
        details: `Feature ${newStatus ? 'enabled' : 'disabled'} for user ${userId}`
      });

      // Update local state
      setUsers(users.map(u =>
        u.id === userId
          ? {
              ...u,
              enabled: newStatus,
              lastModified: new Date().toISOString(),
              overridden: true
            }
          : u
      ));

      // Refresh parent stats
      onUserStatsChange();

      toast({
        title: 'Success',
        description: `Feature ${newStatus ? 'enabled' : 'disabled'} for user`,
      });
    } catch (error) {
      console.error('Error toggling user access:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user access',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeUserOverride = async (userId: string) => {
    try {
      setIsLoading(true);

      // Remove user-specific override
      const featureOverrideRef = doc(db, 'featureOverrides', `${userId}_${featureFlag.id}`);
      await deleteDoc(featureOverrideRef);

      // Record history
      const historyRef = collection(db, 'featureHistory');
      await setDoc(doc(historyRef), {
        featureId: featureFlag.id,
        userId,
        timestamp: serverTimestamp(),
        adminEmail: user?.email || 'unknown',
        action: 'removed_override',
        details: `Removed user-specific override for user ${userId}`
      });

      // Update local state - user now follows global setting
      setUsers(users.map(u =>
        u.id === userId
          ? {
              ...u,
              enabled: featureFlag.enabled, // Back to global setting
              lastModified: 'Never',
              overridden: false
            }
          : u
      ));

      // Refresh parent stats
      onUserStatsChange();

      toast({
        title: 'Success',
        description: 'User override removed - now follows global setting',
      });
    } catch (error) {
      console.error('Error removing user override:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove user override',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const safeUsersForCounts = Array.isArray(users) ? users : [];
  const enabledCount = safeUsersForCounts.filter(u => u.enabled).length;
  const disabledCount = safeUsersForCounts.filter(u => !u.enabled).length;
  const overriddenCount = safeUsersForCounts.filter(u => u.overridden).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Access Control: {featureFlag.name}
          </DialogTitle>
          <DialogDescription>
            Manage individual user access to this feature. Users without specific overrides follow the global setting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Global Status Banner */}
          <div className={`p-3 rounded-lg border ${
            featureFlag.enabled
              ? 'bg-success/10 border-success/30 dark:bg-success/20 dark:border-success/40'
              : 'bg-muted border-border'
          }`}>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="font-medium">Global Setting:</span>
              <Badge variant={featureFlag.enabled ? 'default' : 'secondary'}>
                {featureFlag.enabled ? 'ENABLED' : 'DISABLED'}
              </Badge>
              <span className="text-sm text-muted-foreground">
                (Default for all users without specific overrides)
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by username or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All ({safeUsersForCounts.length})</TabsTrigger>
              <TabsTrigger value="enabled">Enabled ({enabledCount})</TabsTrigger>
              <TabsTrigger value="disabled">Disabled ({disabledCount})</TabsTrigger>
              <TabsTrigger value="overridden">Overridden ({overriddenCount})</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-y-auto max-h-96 space-y-2">
                  {filteredUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.username}</span>
                          {user.overridden && (
                            <Badge variant="outline" className="text-xs">
                              OVERRIDE
                            </Badge>
                          )}
                          {user.enabled ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                        {user.overridden && (
                          <div className="text-xs text-muted-foreground">
                            Override set: {user.lastModified !== 'Never' ? new Date(user.lastModified).toLocaleDateString() : 'Never'}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.enabled}
                          onCheckedChange={() => toggleUserAccess(user.id, user.enabled)}
                          disabled={isLoading}
                        />
                        {user.overridden && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUserOverride(user.id)}
                            disabled={isLoading}
                            title="Remove override (user will follow global setting)"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found matching your criteria
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
