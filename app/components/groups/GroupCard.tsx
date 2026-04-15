'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { UsernameBadge } from '../ui/UsernameBadge';
import { Icon } from '../ui/Icon';
import type { Group } from '../../types/groups';

interface GroupCardProps {
  group: Group;
  className?: string;
}

export function GroupCard({ group, className }: GroupCardProps) {
  return (
    <Link href={`/g/${group.id}`} className="block">
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{group.name}</CardTitle>
            <div className="flex items-center gap-2">
              {group.visibility === 'private' && (
                <Badge variant="secondary" size="sm">
                  <Icon name="Lock" size={12} className="mr-1" />
                  Private
                </Badge>
              )}
              {group.encrypted && (
                <Badge variant="warning" size="sm">
                  <Icon name="Shield" size={12} className="mr-1" />
                  Encrypted
                </Badge>
              )}
            </div>
          </div>
          {group.description && (
            <CardDescription className="line-clamp-2">{group.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Icon name="Users" size={14} />
                {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
              </span>
              <span className="flex items-center gap-1">
                <Icon name="FileText" size={14} />
                {group.pageCount} {group.pageCount === 1 ? 'page' : 'pages'}
              </span>
            </div>
            {group.ownerId && group.ownerUsername && (
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Icon name="User" size={13} />
                  <span>Created by</span>
                </span>
                <UsernameBadge userId={group.ownerId} username={group.ownerUsername} size="sm" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
