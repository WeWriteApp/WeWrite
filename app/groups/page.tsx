'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';
import { useFeatureFlags } from '../contexts/FeatureFlagContext';
import NavPageLayout from '../components/layout/NavPageLayout';
import { Icon } from '../components/ui/Icon';
import { PageHeader } from '../components/ui/PageHeader';
import { GroupCard } from '../components/groups/GroupCard';
import { CreateGroupModal } from '../components/groups/CreateGroupModal';
import { GroupInvitationBanner } from '../components/groups/GroupInvitationBanner';
import type { Group } from '../types/groups';

export default function GroupsPage() {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  // Categorize groups
  const ownedGroups = useMemo(
    () => groups.filter((g) => g.ownerId === user?.uid),
    [groups, user?.uid]
  );
  const joinedGroups = useMemo(
    () => groups.filter((g) => g.ownerId !== user?.uid),
    [groups, user?.uid]
  );

  if (!isEnabled('groups')) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Groups feature is not enabled.</p>
      </div>
    );
  }

  const hasGroups = groups.length > 0;

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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="Loader" size={24} />
        </div>
      ) : !hasGroups ? (
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
        <div className="space-y-6">
          {/* Groups you own */}
          {ownedGroups.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Your Groups
              </h2>
              <div className="space-y-3">
                {ownedGroups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            </section>
          )}

          {/* Groups you've joined */}
          {joinedGroups.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Joined
              </h2>
              <div className="space-y-3">
                {joinedGroups.map((group) => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

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
