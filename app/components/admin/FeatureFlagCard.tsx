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
import { db } from '../../firebase/config';
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
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
  const { session } = useCurrentAccount();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userStats, setUserStats] = useState<UserAccessStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [personalEnabled, setPersonalEnabled] = useState<boolean | null>(null);
  const [loadingPersonal, setLoadingPersonal] = useState(false);

  // Load personal feature flag state on mount
  useEffect(() => {
    if (session) {
      loadPersonalFeatureState();
    }
  }, [, session, flag.id]);

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
    if (!session) return;

    try {
      const featureOverrideRef = doc(db, 'featureOverrides', `${session.uid}_${flag.id}`);
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
    if (!session) return;

    try {
      setLoadingPersonal(true);

      // Update user-specific feature override
      const featureOverrideRef = doc(db, 'featureOverrides', `${session.uid}_${flag.id}`);

      await setDoc(featureOverrideRef, {
        userId: session.uid,
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
      <div className="relative p-4 sm:p-6 border-border border rounded-lg hover:bg-muted/50 transition-colors">
        {/* Header Section */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col gap-3">
            {/* Title and Badges Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <h3 className="font-medium text-base sm:text-lg break-words">{flag.name}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {flag.enabled ? (
                  <Badge variant="default" className="text-xs px-2 py-1">ON</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs px-2 py-1">OFF</Badge>
                )}
                {personalEnabled !== null && personalEnabled !== flag.enabled && (
                  <Badge variant="outline" className="text-xs px-2 py-1">PERSONAL</Badge>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed break-words">{flag.description}</p>
          </div>

          {/* Advanced Options - Desktop Only */}
          <div className="hidden sm:block sm:absolute sm:top-4 sm:right-4">
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="px-3 py-2 h-8 w-8">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="absolute right-0 top-full mt-2 bg-background border-border border rounded-lg shadow-lg p-3 z-20 min-w-48 max-w-64">
                {loadingStats ? (
                  <div className="flex justify-center py-2">
                    <Loader className="h-4 w-4 animate-spin" />
                  </div>
                ) : userStats ? (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      {userStats.usersWithAccess}/{userStats.totalUsers} users have access
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 flex-1"
                        onClick={() => setShowUserModal(true)}
                      >
                        Manage Users
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 px-3"
                        onClick={() => window.open(`/admin/features/${flag.id}`, '_blank')}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Failed to load stats</div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Controls Section - Mobile Optimized */}
        <div className="space-y-4">
          {/* Toggle Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {/* Global Toggle */}
            <div className="flex items-center justify-between p-3 sm:p-0 bg-muted/30 sm:bg-transparent rounded-lg sm:rounded-none">
              <span className="text-sm font-medium text-foreground">Global</span>
              <Switch
                checked={flag.enabled}
                onCheckedChange={(checked) => onToggle(flag.id, checked)}
                disabled={isLoading}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            {/* Personal Toggle */}
            <div className="flex items-center justify-between p-3 sm:p-0 bg-muted/30 sm:bg-transparent rounded-lg sm:rounded-none">
              <span className="text-sm font-medium text-foreground">Personal</span>
              <Switch
                checked={personalEnabled ?? flag.enabled}
                onCheckedChange={handlePersonalToggle}
                disabled={loadingPersonal || !session}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>

          {/* Mobile Actions */}
          <div className="flex gap-3 sm:hidden">
            <Button
              variant="outline"
              size="default"
              className="flex-1 h-11 text-sm font-medium"
              onClick={() => setShowUserModal(true)}
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Button>
            <Button
              variant="outline"
              size="default"
              className="h-11 px-4"
              onClick={() => window.open(`/admin/features/${flag.id}`, '_blank')}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

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