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
      <div className="relative flex items-center justify-between p-4 border-border border rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-medium">{flag.name}</h3>
            <div className="flex items-center gap-2">
              {flag.enabled ? (
                <Badge variant="default" className="text-xs">ON</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">OFF</Badge>
              )}
              {personalEnabled !== null && personalEnabled !== flag.enabled && (
                <Badge variant="outline" className="text-xs">PERSONAL</Badge>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{flag.description}</p>
        </div>


        <div className="flex items-center gap-3">
          {/* Global Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Global:</span>
            <Switch
              checked={flag.enabled}
              onCheckedChange={(checked) => onToggle(flag.id, checked)}
              disabled={isLoading}
            />
          </div>

          {/* Personal Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Personal:</span>
            <Switch
              checked={personalEnabled ?? flag.enabled}
              onCheckedChange={handlePersonalToggle}
              disabled={loadingPersonal || !user}
            />
          </div>


          {/* Advanced Options */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2">
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="absolute right-0 top-full mt-1 bg-background border-border border rounded-lg shadow-lg p-3 z-10 min-w-48">
              {loadingStats ? (
                <div className="flex justify-center py-2">
                  <Loader className="h-4 w-4 animate-spin" />
                </div>
              ) : userStats ? (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {userStats.usersWithAccess}/{userStats.totalUsers} users have access
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setShowUserModal(true)}
                    >
                      Manage Users
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2"
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
