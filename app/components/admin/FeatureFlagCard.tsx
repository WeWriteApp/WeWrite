"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Loader, ChevronDown, Users, Settings, Eye, User, Globe } from 'lucide-react';
import { FeatureFlag } from '../../utils/feature-flags';
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/database';
import { useAuth } from '../../providers/AuthProvider';
import { useToast } from '../ui/use-toast';
import UserAccessModal from './UserAccessModal';

interface FeatureFlagState {
  id: FeatureFlag;
  name: string;
  description: string;
  enabled: boolean;
}

interface FeatureFlagCardProps {
  flag: FeatureFlagState;
  onToggle: (flagId: FeatureFlag, checked: boolean) => void;
  onPersonalToggle?: (flagId: FeatureFlag, checked: boolean) => void;
  isLoading?: boolean;
}

interface UserAccessStats {
  totalUsers: number;
  usersWithAccess: number;
  customOverrides: number;
}

export default function FeatureFlagCard({
  flag,
  onToggle,
  onPersonalToggle,
  isLoading = false
}: FeatureFlagCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userStats, setUserStats] = useState<UserAccessStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [personalEnabled, setPersonalEnabled] = useState<boolean | null>(null);
  const [loadingPersonal, setLoadingPersonal] = useState(false);

  // Load personal feature flag state on mount
  useEffect(() => {
    if (user) {
      loadPersonalFeatureState();
    }
  }, [user, flag.id]);

  // Load user access statistics when expanded
  useEffect(() => {
    if (isExpanded && !userStats) {
      loadUserStats();
    }
  }, [isExpanded, flag.id]);

  const loadUserStats = async () => {
    try {
      setLoadingStats(true);

      // Get total users count
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const totalUsers = usersSnapshot.size;

      // Get user-specific feature overrides
      const featureOverridesRef = collection(db, 'featureOverrides');
      const featureOverridesQuery = query(
        featureOverridesRef,
        where('featureId', '==', flag.id)
      );
      const overridesSnapshot = await getDocs(featureOverridesQuery);

      const customOverrides = overridesSnapshot.size;

      // Calculate users with access based on global flag + overrides
      let usersWithAccess = 0;

      if (flag.enabled) {
        // If globally enabled, count all users minus those with disabled overrides
        usersWithAccess = totalUsers;
        overridesSnapshot.forEach(doc => {
          const data = doc.data();
          if (!data.enabled) {
            usersWithAccess--;
          }
        });
      } else {
        // If globally disabled, count only those with enabled overrides
        overridesSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.enabled) {
            usersWithAccess++;
          }
        });
      }

      setUserStats({
        totalUsers,
        usersWithAccess,
        customOverrides
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Load personal feature flag state
  const loadPersonalFeatureState = async () => {
    if (!user) return;

    try {
      const featureOverrideRef = doc(db, 'featureOverrides', `${user.uid}_${flag.id}`);
      const featureOverrideDoc = await getDoc(featureOverrideRef);

      if (featureOverrideDoc.exists()) {
        const data = featureOverrideDoc.data();
        setPersonalEnabled(data.enabled);
      } else {
        // If no override, use the global setting
        setPersonalEnabled(flag.enabled);
      }
    } catch (error) {
      console.error('Error loading personal feature state:', error);
      setPersonalEnabled(flag.enabled); // Fall back to global setting
    }
  };

  // Handle personal toggle
  const handlePersonalToggle = async (checked: boolean) => {
    if (!user) return;

    try {
      setLoadingPersonal(true);

      // Update user-specific feature override
      const featureOverrideRef = doc(db, 'featureOverrides', `${user.uid}_${flag.id}`);

      await setDoc(featureOverrideRef, {
        userId: user.uid,
        featureId: flag.id,
        enabled: checked,
        lastModified: new Date().toISOString()
      });

      setPersonalEnabled(checked);

      // Call the optional callback
      if (onPersonalToggle) {
        onPersonalToggle(flag.id, checked);
      }

      // Trigger a feature flag refresh event
      try {
        window.dispatchEvent(new CustomEvent('featureFlagChanged', {
          detail: { flagId: flag.id, newValue: checked, timestamp: Date.now(), personal: true }
        }));
      } catch (eventError) {
        console.warn('Could not dispatch personal feature flag change event:', eventError);
      }

      // Show success message
      toast({
        title: 'Success',
        description: `Personal ${flag.name} feature ${checked ? 'enabled' : 'disabled'}`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Error toggling personal feature flag:', error);

      // Revert the UI state
      setPersonalEnabled(!checked);

      // Show error message
      toast({
        title: 'Error',
        description: `Failed to ${checked ? 'enable' : 'disable'} personal ${flag.name} feature`,
        variant: 'destructive'
      });
    } finally {
      setLoadingPersonal(false);
    }
  };

  const handleExpandToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{flag.name}</span>
            {flag.enabled ? (
              <span className="px-2 py-1 text-xs bg-success/10 text-success border border-success/20 rounded-full">
                GLOBALLY ENABLED
              </span>
            ) : (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 rounded-full">
                GLOBALLY DISABLED
              </span>
            )}
            {personalEnabled !== null && personalEnabled !== flag.enabled && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                PERSONAL OVERRIDE
              </span>
            )}
          </div>
        </div>

        {/* Personal Toggle Section */}
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Personal Access</span>
                <p className="text-xs text-blue-700 dark:text-blue-300">Controls this feature for you only</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {loadingPersonal && (
                <Loader className="h-4 w-4 animate-spin text-blue-600" />
              )}
              <Switch
                checked={personalEnabled ?? flag.enabled}
                onCheckedChange={handlePersonalToggle}
                disabled={loadingPersonal || !user}
              />
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-3">{flag.description}</p>

        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between p-2 h-auto"
              onClick={handleExpandToggle}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="text-sm">User Access Control</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-3 pt-3">
            {/* Global Toggle Section */}
            <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <div>
                    <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Global Access Control</span>
                    <p className="text-xs text-orange-700 dark:text-orange-300">Controls this feature for ALL users in the system</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLoading && (
                    <Loader className="h-4 w-4 animate-spin text-orange-600" />
                  )}
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={(checked) => onToggle(flag.id, checked)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 p-2 rounded">
                ⚠️ <strong>Warning:</strong> This affects all users. Individual user overrides will still apply.
              </div>
            </div>

            {loadingStats ? (
              <div className="flex justify-center py-4">
                <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : userStats ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-lg font-semibold">{userStats.totalUsers}</div>
                    <div className="text-xs text-muted-foreground">Total Users</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-lg font-semibold text-green-600">{userStats.usersWithAccess}</div>
                    <div className="text-xs text-muted-foreground">With Access</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-lg font-semibold text-blue-600">{userStats.customOverrides}</div>
                    <div className="text-xs text-muted-foreground">Overrides</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowUserModal(true)}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Manage Users
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/admin/features/${flag.id}`, '_blank')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Failed to load user statistics
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {showUserModal && (
        <UserAccessModal
          featureFlag={flag}
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
          onUserStatsChange={loadUserStats}
        />
      )}
    </>
  );
}
