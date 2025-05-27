"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Loader, ChevronDown, Users, Settings, Eye } from 'lucide-react';
import { FeatureFlag } from '../../utils/feature-flags';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/database';
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
  isLoading = false
}: FeatureFlagCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [userStats, setUserStats] = useState<UserAccessStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

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
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">
                ENABLED
              </span>
            ) : (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 rounded-full">
                DISABLED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={flag.enabled}
              onCheckedChange={(checked) => onToggle(flag.id, checked)}
              disabled={isLoading}
            />
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
