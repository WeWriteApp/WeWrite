import React from 'react';
import { GroupCard } from '../components/groups/GroupCard';
import type { Group } from '../types/groups';
import { Icon } from '../components/ui/Icon';

interface MyGroupsListProps {
  groups: Group[];
  onViewAll?: () => void;
}

export function MyGroupsList({ groups, onViewAll }: MyGroupsListProps) {
  if (!groups.length) {
    return (
      <div className="text-center py-12">
        <Icon name="Users" size={40} className="mx-auto mb-3 text-muted-foreground/50" />
        <h2 className="text-lg font-medium mb-1">No groups yet</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Create a group to collaborate with others.
        </p>
      </div>
    );
  }

  const maxDisplay = 4;
  const showViewAll = groups.length > maxDisplay;
  const displayGroups = showViewAll ? groups.slice(0, maxDisplay) : groups;

  return (
    <div className="space-y-4">
      {displayGroups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
      {showViewAll && (
        <button
          className="w-full mt-2 py-2 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
          onClick={onViewAll}
        >
          View all {groups.length} groups
        </button>
      )}
    </div>
  );
}
