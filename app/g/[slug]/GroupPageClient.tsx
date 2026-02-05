'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../providers/AuthProvider';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import NavPageLayout from '../../components/layout/NavPageLayout';
import { Icon } from '../../components/ui/Icon';
import { PageHeader } from '../../components/ui/PageHeader';
import { GroupPageList } from '../../components/groups/GroupPageList';
import { GroupMemberList } from '../../components/groups/GroupMemberList';
import { InviteMemberModal } from '../../components/groups/InviteMemberModal';
import { FundDistributionEditor } from '../../components/groups/FundDistributionEditor';
import { GroupEarningsSummary } from '../../components/groups/GroupEarningsSummary';
import type { Group, GroupMember } from '../../types/groups';

interface GroupPageClientProps {
  initialGroup: Group;
}

export default function GroupPageClient({ initialGroup }: GroupPageClientProps) {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group>(initialGroup);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'pages' | 'members' | 'earnings'>('pages');

  const isMember = user?.uid ? group.memberIds.includes(user.uid) : false;
  const isOwnerOrAdmin = isMember && members.some(
    (m) => m.userId === user?.uid && (m.role === 'owner' || m.role === 'admin')
  );

  useEffect(() => {
    const fetchGroupDetails = async () => {
      try {
        const res = await fetch(`/api/groups/${group.id}`, { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.data) {
          setGroup(data.data);
          setMembers(data.data.members || []);
        }
      } catch {
        // Use initial data
      }
    };

    fetchGroupDetails();
  }, [group.id]);

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from the group?')) return;

    try {
      const res = await fetch(`/api/groups/${group.id}/members/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        setGroup((prev) => ({
          ...prev,
          memberIds: prev.memberIds.filter((id) => id !== userId),
          memberCount: prev.memberCount - 1,
        }));
      }
    } catch {
      // Silently ignore
    }
  };

  return (
    <NavPageLayout>
      <PageHeader
        title={group.name}
        description={group.description || undefined}
        badges={
          group.visibility === 'private' ? (
            <Badge variant="secondary" size="sm">
              <Icon name="Lock" size={12} className="mr-1" />
              Private
            </Badge>
          ) : undefined
        }
        actions={
          isOwnerOrAdmin ? (
            <Link
              href={`/g/${group.slug}/settings`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="Settings" size={18} />
            </Link>
          ) : undefined
        }
      >
        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
          <span className="flex items-center gap-1">
            <Icon name="Users" size={14} />
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="FileText" size={14} />
            {group.pageCount} {group.pageCount === 1 ? 'page' : 'pages'}
          </span>
          {group.ownerUsername && (
            <span>
              by <Link href={`/@${group.ownerUsername}`} className="hover:underline">{group.ownerUsername}</Link>
            </span>
          )}
        </div>
      </PageHeader>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border mb-4">
        <button
          onClick={() => setActiveTab('pages')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pages'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Pages
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'members'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Members
        </button>
        {isMember && (
          <button
            onClick={() => setActiveTab('earnings')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'earnings'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Earnings
          </button>
        )}
        {isOwnerOrAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="ml-auto px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Icon name="UserPlus" size={14} className="mr-1 inline" />
            Invite
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'pages' && (
        <GroupPageList groupId={group.id} isMember={isMember} />
      )}

      {activeTab === 'members' && (
        <GroupMemberList
          members={members}
          ownerId={group.ownerId}
          currentUserId={user?.uid || null}
          canManage={isOwnerOrAdmin}
          onRemoveMember={handleRemoveMember}
        />
      )}

      {activeTab === 'earnings' && isMember && (
        <div className="space-y-6">
          <FundDistributionEditor
            groupId={group.id}
            members={members}
            initialDistribution={group.fundDistribution || {}}
            canEdit={isOwnerOrAdmin}
            onSaved={(dist) => setGroup((prev) => ({ ...prev, fundDistribution: dist }))}
          />
          <GroupEarningsSummary groupId={group.id} />
        </div>
      )}

      {/* Invite Modal */}
      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        groupId={group.id}
        onInvited={() => {
          // Refresh members
          fetch(`/api/groups/${group.id}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.data?.members) setMembers(d.data.members);
            })
            .catch(() => {});
        }}
      />
    </NavPageLayout>
  );
}
