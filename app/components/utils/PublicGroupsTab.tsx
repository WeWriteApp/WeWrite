'use client';

import React, { useState, useEffect } from 'react';
import { GroupCard } from '../groups/GroupCard';
import EmptyState from '../ui/EmptyState';
import { Icon } from '../ui/Icon';
import type { Group } from '../../types/groups';

interface PublicGroupsTabProps {
  userId: string;
  username?: string;
  isOwnProfile?: boolean;
}

export default function PublicGroupsTab({ userId, username, isOwnProfile }: PublicGroupsTabProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/groups${isOwnProfile ? '' : `?userId=${encodeURIComponent(userId)}`}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.success) {
          const groups = Array.isArray(data.data) ? data.data : data.data?.groups;
          setGroups(Array.isArray(groups) ? groups : []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Icon name="Loader" size={24} />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon="Users"
        title="No public groups"
        description={
          isOwnProfile
            ? "You're not a member of any public groups yet."
            : `${username || 'This user'} isn't a member of any public groups.`
        }
        size="sm"
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
    </div>
  );
}
