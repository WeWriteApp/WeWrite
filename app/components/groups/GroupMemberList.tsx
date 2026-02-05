'use client';

import React from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Icon } from '../ui/Icon';
import type { GroupMember } from '../../types/groups';

interface GroupMemberListProps {
  members: GroupMember[];
  ownerId: string;
  currentUserId: string | null;
  canManage: boolean;
  onRemoveMember?: (userId: string) => void;
}

export function GroupMemberList({
  members,
  ownerId,
  currentUserId,
  canManage,
  onRemoveMember,
}: GroupMemberListProps) {
  return (
    <div className="divide-y divide-border">
      {members.map((member) => (
        <div key={member.userId} className="flex items-center justify-between py-3 px-1">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {(member.username || member.userId).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="font-medium text-sm">
                {member.username || member.userId}
              </span>
              {member.userId === currentUserId && (
                <span className="text-xs text-muted-foreground ml-1">(you)</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary-static" size="sm">
              {member.role}
            </Badge>
            {canManage && member.userId !== ownerId && member.userId !== currentUserId && onRemoveMember && (
              <button
                onClick={() => onRemoveMember(member.userId)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                title="Remove member"
              >
                <Icon name="X" size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
