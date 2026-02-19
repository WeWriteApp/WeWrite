'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '../../providers/AuthProvider';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import NavPageLayout from '../../components/layout/NavPageLayout';
import { Icon } from '../../components/ui/Icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useTabNavigation } from '../../hooks/useTabNavigation';
import GroupProfileHeader from '../../components/groups/GroupProfileHeader';
import GroupStats from '../../components/groups/GroupStats';
import GroupAboutTab from '../../components/groups/GroupAboutTab';
import { GroupPageList } from '../../components/groups/GroupPageList';
import { GroupMemberList } from '../../components/groups/GroupMemberList';
import { InviteMemberModal } from '../../components/groups/InviteMemberModal';
import { FundDistributionEditor } from '../../components/groups/FundDistributionEditor';
import { GroupEarningsSummary } from '../../components/groups/GroupEarningsSummary';
import ActivityFeed from '../../components/features/ActivityFeed';
import type { Group, GroupMember } from '../../types/groups';

// Dynamic imports for heavy tab components
const GroupTimelineTab = dynamic(() => import('../../components/groups/GroupTimelineTab'), {
  ssr: false,
  loading: () => (
    <div className="p-4 animate-pulse">
      <div className="h-6 w-28 bg-muted rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded" />)}
      </div>
    </div>
  )
});

const GroupMapTab = dynamic(() => import('../../components/groups/GroupMapTab'), {
  ssr: false,
  loading: () => (
    <div className="p-4 animate-pulse">
      <div className="h-6 w-24 bg-muted rounded mb-4" />
      <div className="h-64 bg-muted rounded" />
    </div>
  )
});

const GroupGraphTab = dynamic(() => import('../../components/groups/GroupGraphTab'), {
  ssr: false,
  loading: () => (
    <div className="p-4 animate-pulse">
      <div className="h-6 w-28 bg-muted rounded mb-4" />
      <div className="h-64 bg-muted rounded" />
    </div>
  )
});

const GroupExternalLinksTab = dynamic(() => import('../../components/groups/GroupExternalLinksTab'), {
  ssr: false,
  loading: () => (
    <div className="p-4 animate-pulse">
      <div className="h-6 w-32 bg-muted rounded mb-4" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
      </div>
    </div>
  )
});

const VALID_GROUP_TABS = ['about', 'pages', 'members', 'activity', 'timeline', 'map', 'graph', 'external-links', 'earnings'];

interface GroupPageClientProps {
  initialGroup: Group;
}

function createdAtString(group: Group): string | undefined {
  const raw = group.createdAt;
  if (typeof raw === 'string') return raw;
  if (raw && typeof (raw as any).toDate === 'function') {
    return (raw as any).toDate().toISOString();
  }
  return undefined;
}

function GroupPageClientInner({ initialGroup }: GroupPageClientProps) {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group>(initialGroup);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { activeTab, setActiveTab } = useTabNavigation({
    defaultTab: 'about',
    validTabs: VALID_GROUP_TABS,
    migrateFromHash: true,
  });

  const isMember = user?.uid ? group.memberIds.includes(user.uid) : false;
  const isOwnerOrAdmin =
    isMember &&
    members.some((m) => m.userId === user?.uid && (m.role === 'owner' || m.role === 'admin'));

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

  const tabTriggerClass =
    'flex items-center gap-1.5 rounded-none px-4 py-3 font-medium text-muted-foreground data-[state=active]:text-primary relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-primary';

  return (
    <NavPageLayout header="userProfile">
      <GroupProfileHeader
        groupId={group.id}
        groupName={group.name}
        showSettings={isOwnerOrAdmin}
      />

      {/* Profile-style card: name, badge, owner, KPI strip */}
      <div className="wewrite-card pb-4">
        <div className="flex flex-col items-center">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
            <h1 className="text-lg font-semibold text-foreground">{group.name}</h1>
            {group.visibility === 'private' && (
              <Badge variant="secondary" size="sm">
                <Icon name="Lock" size={12} className="mr-1" />
                Private
              </Badge>
            )}
          </div>
          {group.ownerUsername && (
            <p className="text-sm text-muted-foreground mb-2">
              by{' '}
              <Link
                href={`/u/${group.ownerUsername}`}
                className="hover:underline text-foreground"
              >
                {group.ownerUsername}
              </Link>
            </p>
          )}
        </div>
        <GroupStats
          memberCount={group.memberCount}
          pageCount={group.pageCount}
          createdAt={createdAtString(group)}
          visibility={group.visibility}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-border bg-background">
          <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            <TabsList className="flex w-max border-0 bg-transparent p-0 h-auto min-h-0">
              <TabsTrigger value="about" data-value="about" className={tabTriggerClass}>
                <Icon name="Info" size={16} />
                <span>About</span>
              </TabsTrigger>
              <TabsTrigger value="pages" data-value="pages" className={tabTriggerClass}>
                <Icon name="FileText" size={16} />
                <span>Pages</span>
              </TabsTrigger>
              <TabsTrigger value="members" data-value="members" className={tabTriggerClass}>
                <Icon name="Users" size={16} />
                <span>Members</span>
              </TabsTrigger>
              <TabsTrigger value="activity" data-value="activity" className={tabTriggerClass}>
                <Icon name="Activity" size={16} />
                <span>Activity</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" data-value="timeline" className={tabTriggerClass}>
                <Icon name="Calendar" size={16} />
                <span>Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="map" data-value="map" className={tabTriggerClass}>
                <Icon name="MapPin" size={16} />
                <span>Map</span>
              </TabsTrigger>
              <TabsTrigger value="graph" data-value="graph" className={tabTriggerClass}>
                <Icon name="Network" size={16} />
                <span>Graph</span>
              </TabsTrigger>
              <TabsTrigger value="external-links" data-value="external-links" className={tabTriggerClass}>
                <Icon name="Link" size={16} />
                <span>External Links</span>
              </TabsTrigger>
              {isMember && (
                <TabsTrigger value="earnings" data-value="earnings" className={tabTriggerClass}>
                  <Icon name="DollarSign" size={16} />
                  <span>Earnings</span>
                </TabsTrigger>
              )}
            </TabsList>
            {isOwnerOrAdmin && (
              <Button
                size="sm"
                onClick={() => setShowInviteModal(true)}
                className="ml-auto shrink-0"
              >
                <Icon name="UserPlus" size={14} />
                Invite
              </Button>
            )}
          </div>
        </div>

        <div className="pt-4">
          <TabsContent value="about" className="mt-0">
            <GroupAboutTab
              groupId={group.id}
              initialDescription={group.description || ''}
              canEdit={!!isOwnerOrAdmin}
              onSaved={(description) => setGroup((prev) => ({ ...prev, description }))}
            />
          </TabsContent>

          <TabsContent value="pages" className="mt-0">
            <GroupPageList groupId={group.id} isMember={isMember} />
          </TabsContent>

          <TabsContent value="members" className="mt-0">
            <GroupMemberList
              members={members}
              ownerId={group.ownerId}
              currentUserId={user?.uid || null}
              canManage={isOwnerOrAdmin}
              onRemoveMember={handleRemoveMember}
            />
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <ActivityFeed
              mode="group"
              filterByGroupId={group.id}
              filterByGroupName={group.name}
              limit={20}
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-0">
            <GroupTimelineTab groupId={group.id} groupName={group.name} />
          </TabsContent>

          <TabsContent value="map" className="mt-0">
            {activeTab === 'map' && (
              <GroupMapTab groupId={group.id} groupName={group.name} />
            )}
          </TabsContent>

          <TabsContent value="graph" className="mt-0">
            <GroupGraphTab groupId={group.id} groupName={group.name} />
          </TabsContent>

          <TabsContent value="external-links" className="mt-0">
            <GroupExternalLinksTab
              groupId={group.id}
              groupName={group.name}
              currentUserId={user?.uid || null}
            />
          </TabsContent>

          {isMember && (
            <TabsContent value="earnings" className="mt-0">
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
            </TabsContent>
          )}
        </div>
      </Tabs>

      <InviteMemberModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        groupId={group.id}
        onInvited={() => {
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

export default function GroupPageClient({ initialGroup }: GroupPageClientProps) {
  return (
    <Suspense fallback={<NavPageLayout header="userProfile"><div className="animate-pulse p-8"><div className="h-8 bg-muted rounded w-48 mx-auto" /></div></NavPageLayout>}>
      <GroupPageClientInner initialGroup={initialGroup} />
    </Suspense>
  );
}
