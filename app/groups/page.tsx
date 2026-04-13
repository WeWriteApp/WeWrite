'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { useFeatureFlags } from '../contexts/FeatureFlagContext';
import NavPageLayout from '../components/layout/NavPageLayout';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { GroupCard } from '../components/groups/GroupCard';
import { CreateGroupModal } from '../components/groups/CreateGroupModal';
import { GroupInvitationBanner } from '../components/groups/GroupInvitationBanner';
import {
  SegmentedControl,
  SegmentedControlContent,
  SegmentedControlList,
  SegmentedControlTrigger,
} from '../components/ui/segmented-control';
import type { Group } from '../types/groups';

export default function GroupsPage() {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Discover tab state
  const [discoverGroups, setDiscoverGroups] = useState<Group[]>([]);
  const [isDiscoverLoading, setIsDiscoverLoading] = useState(false);
  const [discoverFetched, setDiscoverFetched] = useState(false);

  useEffect(() => {
    if (!isEnabled('groups')) return;

    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/groups', { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.data?.groups) {
          setGroups(data.data.groups);
        }
      } catch {
        console.error('Failed to fetch groups');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, [isEnabled]);

  const fetchDiscoverGroups = useCallback(async () => {
    if (discoverFetched) return;
    setIsDiscoverLoading(true);
    try {
      const res = await fetch('/api/groups?discover=true', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data?.groups) {
        setDiscoverGroups(data.data.groups);
      }
    } catch {
      console.error('Failed to fetch discover groups');
    } finally {
      setIsDiscoverLoading(false);
      setDiscoverFetched(true);
    }
  }, [discoverFetched]);

  const handleTabChange = (value: string) => {
    if (value === 'discover') {
      fetchDiscoverGroups();
    }
  };

  // Filter out user's own groups from discover results
  const myGroupIds = new Set(groups.map((g) => g.id));
  const filteredDiscoverGroups = discoverGroups.filter((g) => !myGroupIds.has(g.id));

  if (!isEnabled('groups')) {
    return (
      <NavPageLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Groups feature is not enabled.</p>
        </div>
      </NavPageLayout>
    );
  }

  return (
    <NavPageLayout>
      <PageHeader
        title="Groups"
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Icon name="Plus" size={14} />
            New Group
          </button>
        }
      />

      <GroupInvitationBanner />

      <SegmentedControl defaultValue="my-groups" onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
        <SegmentedControlList className="grid w-full grid-cols-2 max-w-md">
          <SegmentedControlTrigger value="my-groups" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            My Groups
          </SegmentedControlTrigger>
          <SegmentedControlTrigger value="discover" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            Discover
          </SegmentedControlTrigger>
        </SegmentedControlList>

        <SegmentedControlContent value="my-groups">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader" size={24} />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="Users" size={40} className="mx-auto mb-3 text-muted-foreground/50" />
              <h2 className="text-lg font-medium mb-1">No groups yet</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Create a group to collaborate with others.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Create Your First Group
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </SegmentedControlContent>

        <SegmentedControlContent value="discover">
          {isDiscoverLoading ? (
            <div className="flex items-center justify-center py-12">
              <Icon name="Loader" size={24} />
            </div>
          ) : filteredDiscoverGroups.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="Globe" size={40} className="mx-auto mb-3 text-muted-foreground/50" />
              <h2 className="text-lg font-medium mb-1">No groups to discover</h2>
              <p className="text-muted-foreground text-sm">
                All public groups will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDiscoverGroups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          )}
        </SegmentedControlContent>
      </SegmentedControl>

      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(newGroup) => {
          setGroups((prev) => [newGroup, ...prev]);
          router.push(`/g/${newGroup.id}`);
        }}
      />
    </NavPageLayout>
  );
}
