"use client";

import React, { useState, useEffect } from 'react';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { ChevronRight, Users, Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/database';
import { useToast } from '../ui/use-toast';
import { FeatureFlag } from '../../utils/feature-flags';

interface FeatureFlagState {
  id: FeatureFlag;
  name: string;
  description: string;
  enabled: boolean;
}

interface EnhancedFeatureFlagCardProps {
  flag: FeatureFlagState;
  userEmail: string;
  userId: string;
  onToggleGlobal: (flagId: FeatureFlag, checked: boolean) => void;
  onNavigate: (flagId: FeatureFlag) => void;
}

interface UserAccessStats {
  usersWithAccess: number;
  totalUsers: number;
  percentage: number;
}

export default function EnhancedFeatureFlagCard({
  flag,
  userEmail,
  userId,
  onToggleGlobal,
  onNavigate
}: EnhancedFeatureFlagCardProps) {
  const [personalAccess, setPersonalAccess] = useState<boolean | null>(null);
  const [userStats, setUserStats] = useState<UserAccessStats | null>(null);
  const [isTogglingPersonal, setIsTogglingPersonal] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const { toast } = useToast();

  // Load personal access status
  useEffect(() => {
    const loadPersonalAccess = async () => {
      if (!userEmail) return;

      try {
        // Check if there's a user-specific override for the admin
        const featureOverrideRef = doc(db, 'featureOverrides', `${userId}_${flag.id}`);
        const featureOverrideDoc = await getDoc(featureOverrideRef);

        if (featureOverrideDoc.exists()) {
          const data = featureOverrideDoc.data();
          setPersonalAccess(data.enabled);
        } else {
          // If no override, use the global setting
          setPersonalAccess(flag.enabled);
        }
      } catch (error) {
        console.error('Error loading personal access:', error);
        setPersonalAccess(flag.enabled); // Fall back to global setting
      }
    };

    loadPersonalAccess();
  }, [flag.id, flag.enabled, userEmail, userId]);

  // Load user access statistics
  useEffect(() => {
    const loadUserStats = async () => {
      try {
        setIsLoadingStats(true);

        // Get total user count
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const totalUsers = usersSnapshot.size;

        // Get user-specific feature overrides for this feature
        const featureOverridesRef = collection(db, 'featureOverrides');
        const featureOverridesQuery = query(
          featureOverridesRef,
          where('featureId', '==', flag.id),
          where('enabled', '==', true)
        );
        const overridesSnapshot = await getDocs(featureOverridesQuery);

        // Count users with explicit access
        let usersWithAccess = overridesSnapshot.size;

        // If the global flag is enabled, all users without explicit overrides also have access
        if (flag.enabled) {
          // Get users with explicit disabled overrides
          const disabledOverridesQuery = query(
            featureOverridesRef,
            where('featureId', '==', flag.id),
            where('enabled', '==', false)
          );
          const disabledOverridesSnapshot = await getDocs(disabledOverridesQuery);

          // Users with access = total users - users with disabled overrides
          usersWithAccess = totalUsers - disabledOverridesSnapshot.size;
        }

        const percentage = totalUsers > 0 ? Math.round((usersWithAccess / totalUsers) * 100) : 0;

        setUserStats({
          usersWithAccess,
          totalUsers,
          percentage
        });
      } catch (error) {
        console.error('Error loading user stats:', error);
        setUserStats({ usersWithAccess: 0, totalUsers: 0, percentage: 0 });
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadUserStats();
  }, [flag.id, flag.enabled, personalAccess]);

  // Toggle personal access
  const handlePersonalToggle = async (checked: boolean) => {
    if (!userEmail) return;

    try {
      setIsTogglingPersonal(true);

      // Update user-specific feature override
      const featureOverrideRef = doc(db, 'featureOverrides', `${userId}_${flag.id}`);

      await setDoc(featureOverrideRef, {
        userId: userId,
        featureId: flag.id,
        enabled: checked,
        lastModified: new Date().toISOString()
      });

      setPersonalAccess(checked);

      toast({
        title: 'Success',
        description: `Your access to ${flag.name} has been ${checked ? 'enabled' : 'disabled'}`,
      });

      // Trigger a re-render of the stats by updating the dependency
      // This will cause the useEffect to run again and reload the stats
      setIsLoadingStats(true);

    } catch (error) {
      console.error('Error toggling personal access:', error);
      toast({
        title: 'Error',
        description: 'Failed to update your access. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsTogglingPersonal(false);
    }
  };

  // Handle card click (navigate to detail page)
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on switches
    if ((e.target as HTMLElement).closest('[data-switch]')) {
      return;
    }
    onNavigate(flag.id);
  };

  return (
    <div
      className="flex flex-col p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors relative cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header with title and global status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{flag.name}</span>
          {flag.enabled ? (
            <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Global ON
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Global OFF
            </Badge>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-3">{flag.description}</p>

      {/* User statistics */}
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        {isLoadingStats ? (
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs text-muted-foreground">Loading...</span>
          </div>
        ) : userStats ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">
              {userStats.usersWithAccess}/{userStats.totalUsers} users
            </span>
            <Badge variant="outline" className="text-xs">
              {userStats.percentage}%
            </Badge>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Stats unavailable</span>
        )}
      </div>

      {/* Personal access toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-sm font-medium">Your Access:</span>
        <div data-switch className="flex items-center gap-2">
          {personalAccess !== null && (
            <span className="text-xs text-muted-foreground">
              {personalAccess ? 'Enabled' : 'Disabled'}
            </span>
          )}
          <Switch
            checked={personalAccess ?? false}
            onCheckedChange={handlePersonalToggle}
            disabled={isTogglingPersonal || personalAccess === null}
            onClick={(e) => e.stopPropagation()}
          />
          {isTogglingPersonal && (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
}
