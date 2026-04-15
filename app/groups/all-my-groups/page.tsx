'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavPageLayout from '../../components/layout/NavPageLayout';
import { Icon } from '../../components/ui/Icon';
import { GroupCard } from '../../components/groups/GroupCard';
import type { Group } from '../../types/groups';

export default function AllMyGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch('/api/groups', { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.data?.groups) {
          setGroups(data.data.groups);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    fetchGroups();
  }, []);

  return (
    <NavPageLayout>
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => router.back()} className="p-2 rounded hover:bg-muted">
          <Icon name="ArrowLeft" size={18} />
        </button>
        <h1 className="text-xl font-bold">All My Groups</h1>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="Loader" size={24} />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12">
          <Icon name="Users" size={40} className="mx-auto mb-3 text-muted-foreground/50" />
          <h2 className="text-lg font-medium mb-1">No groups yet</h2>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </NavPageLayout>
  );
}
