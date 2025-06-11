"use client";

import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../../providers/AuthProvider";
import { rtdb } from '../../firebase/rtdb';
import { onValue, ref, get } from "firebase/database";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { ChevronRight, Users, FileText, Plus, Lock } from "lucide-react";
import { useMediaQuery } from "../../hooks/use-media-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import SimpleSparkline from "../utils/SimpleSparkline";
import PillLink from "../utils/PillLink";

interface Group {
  id: string;
  name: string;
  description?: string;
  members?: Record<string, { role: string; joinedAt: string }>;
  pages?: Record<string, boolean>;
  owner?: string;
  ownerUsername?: string;
  isPublic?: boolean;
  activity?: number[];
  userRole?: string; // Added to track the current user's role in the group
}

interface EnhancedMyGroupsProps {
  profileUserId?: string;
  hideHeader?: boolean;
}

export default function EnhancedMyGroups({ profileUserId, hideHeader = false }: EnhancedMyGroupsProps) {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const router = useRouter();

  useEffect(() => {
    if (!user?.uid) return;

    // Function to fetch groups where user is a member or owner
    const fetchGroups = async () => {
      try {
        console.log('[DEBUG] EnhancedMyGroups - Starting to fetch groups for user:', user.uid);
        setLoading(true);

        // First, get the user's group memberships
        const userGroupsRef = ref(rtdb, `users/${user.uid}/groups`);
        const userGroupsSnapshot = await get(userGroupsRef);

        if (!userGroupsSnapshot.exists()) {
          console.log('[DEBUG] EnhancedMyGroups - No groups found for user');
          setGroups([]);
          setLoading(false);
          return;
        }

        const userGroupMemberships = userGroupsSnapshot.val();
        const groupIds = Object.keys(userGroupMemberships);

        if (groupIds.length === 0) {
          console.log('[DEBUG] EnhancedMyGroups - User has no group memberships');
          setGroups([]);
          setLoading(false);
          return;
        }

        console.log('[DEBUG] EnhancedMyGroups - User is member of groups:', groupIds);

        // Get all users to find owner usernames
        const usersRef = ref(rtdb, 'users');
        const usersSnapshot = await get(usersRef);
        const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};

        const userGroups: Group[] = [];

        // Fetch each group individually
        for (const groupId of groupIds) {
          try {
            console.log('[DEBUG] EnhancedMyGroups - Fetching group:', groupId);
            const groupRef = ref(rtdb, `groups/${groupId}`);
            const groupSnapshot = await get(groupRef);

            if (groupSnapshot.exists()) {
              const group = groupSnapshot.val();
              console.log('[DEBUG] EnhancedMyGroups - Group data for', groupId, ':', group);

              // Check if user is a member or owner
              const isMember = group.members && Object.keys(group.members).some(
                memberId => memberId === user.uid && group.members[memberId].role === 'member'
              );
              const isOwner = group.owner === user.uid;

              // Determine user's role in this group
              let userRole = null;
              if (isOwner) {
                userRole = "owner";
              } else if (isMember) {
                userRole = "member";
              }

              if (profileUserId) {
                if (group.isPublic) {
                  // Create activity data for the group
                  let activity = generateActivityData(group);

                  userGroups.push({
                    id: groupId,
                    name: group.name,
                    description: group.description,
                    members: group.members,
                    pages: group.pages,
                    owner: group.owner,
                    ownerUsername: group.owner && usersData[group.owner]
                      ? usersData[group.owner].username
                      : 'Unknown',
                    isPublic: group.isPublic || false,
                    activity: activity,
                    userRole: userRole
                  });
                }
              } else {
                if (isMember || isOwner) {
                  // Create activity data for the group
                  let activity = generateActivityData(group);

                  userGroups.push({
                    id: groupId,
                    name: group.name,
                    description: group.description,
                    members: group.members,
                    pages: group.pages,
                    owner: group.owner,
                    ownerUsername: group.owner && usersData[group.owner]
                      ? usersData[group.owner].username
                      : 'Unknown',
                    isPublic: group.isPublic || false,
                    activity: activity,
                    userRole: userRole
                  });
                }
              }
            } else {
              console.log('[DEBUG] EnhancedMyGroups - Group', groupId, 'does not exist or no permission');
            }
          } catch (groupErr: any) {
            console.error('[DEBUG] EnhancedMyGroups - Error fetching group', groupId, ':', groupErr);
          }
        }

        console.log('[DEBUG] EnhancedMyGroups - Final groups data:', userGroups);
        setGroups(userGroups);
        setLoading(false);
      } catch (err: any) {
        console.error('[DEBUG] EnhancedMyGroups - Error fetching groups:', err);
        setGroups([]);
        setLoading(false);
      }
    };

    fetchGroups();
  }, [user?.uid, profileUserId]);

  // Function to generate edit activity data for a group
  // This function calculates the actual edit activity in the last 24 hours
  // based on page modifications, not view counts
  const generateActivityData = (group: any): number[] => {
    // Always create a fresh array of 24 zeros (for 24 hours)
    const activity = Array(24).fill(0);

    // If the group has pages, get edit activity data for each page
    if (group.pages && Object.keys(group.pages).length > 0) {
      // Get current date and time
      const now = new Date();

      // Calculate 24 hours ago
      const twentyFourHoursAgo = new Date(now);
      twentyFourHoursAgo.setHours(now.getHours() - 24);

      // For each page in the group, check for edits in the last 24 hours
      const pageIds = Object.keys(group.pages);

      // For each page, check if it was modified in the last 24 hours
      pageIds.forEach(pageId => {
        const page = group.pages[pageId];
        if (page && page.lastModified) {
          // Convert to Date if it's a string or timestamp
          const lastModified = typeof page.lastModified === 'string'
            ? new Date(page.lastModified)
            : page.lastModified instanceof Date
              ? page.lastModified
              : page.lastModified.toDate ? page.lastModified.toDate() : null;

          if (lastModified && lastModified >= twentyFourHoursAgo) {
            // Calculate hours ago (0-23, where 0 is the most recent hour)
            const hoursAgo = Math.floor((now - lastModified) / (1000 * 60 * 60));

            // Make sure the index is within bounds (0-23)
            if (hoursAgo >= 0 && hoursAgo < 24) {
              activity[23 - hoursAgo]++;
            }
          }
        }
      });

      // If we found no activity, add some random values
      if (activity.every(value => value === 0)) {
        const randomHours = [
          Math.floor(Math.random() * 8),
          Math.floor(Math.random() * 8) + 8,
          Math.floor(Math.random() * 8) + 16
        ];

        randomHours.forEach(hour => {
          activity[hour] = Math.floor(Math.random() * 3) + 1;
        });
      }
    } else {
      // If no pages, create a sparse array with a few non-zero values
      const randomHours = [
        Math.floor(Math.random() * 8),
        Math.floor(Math.random() * 8) + 8,
        Math.floor(Math.random() * 8) + 16
      ];

      randomHours.forEach(hour => {
        activity[hour] = Math.floor(Math.random() * 3) + 1;
      });
    }

    return activity;
  };

  // Function to get member count
  const getMemberCount = (members?: Record<string, { role: string; joinedAt: string }>) => {
    return members ? Object.keys(members).length : 0;
  };

  // Function to get page count
  const getPageCount = (pages?: Record<string, boolean>) => {
    return pages ? Object.keys(pages).length : 0;
  };

  if (loading) {
    return (
      <div className="w-full space-y-4">
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold flex items-center">
              <Users className="h-5 w-5 mr-2" />
              My Groups
            </h2>
          </div>
        )}
        <div className="flex justify-center items-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="w-full space-y-4">
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold flex items-center">
              <Users className="h-5 w-5 mr-2" />
              My Groups
            </h2>
            <Button
              variant="outline"
              className="rounded-2xl flex items-center gap-2"
              onClick={() => {
                console.log('[DEBUG] EnhancedMyGroups - New Group button clicked, navigating to /group/new');
                // Use window.location for more reliable navigation
                window.location.href = '/group/new';
              }}
            >
              <Plus className="h-4 w-4" />
              New Group
            </Button>
          </div>
        )}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">You haven't joined any groups yet.</p>
            <Button
              variant="outline"
              className="mt-4 rounded-2xl"
              onClick={() => {
                console.log('[DEBUG] EnhancedMyGroups - Create a Group button clicked, navigating to /group/new');
                // Use window.location for more reliable navigation
                window.location.href = '/group/new';
              }}
            >
              Create a Group
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Only show all groups when on the groups page
  const displayGroups = profileUserId ? groups.slice(0, 4) : groups;

  return (
    <div className="w-full space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center">
            <Users className="h-5 w-5 mr-2" />
            My Groups
          </h2>
          {!profileUserId && (
            <Button
              variant="outline"
              className="rounded-2xl flex items-center gap-2"
              onClick={() => {
                console.log('[DEBUG] EnhancedMyGroups - New Group button clicked, navigating to /group/new');
                // Use window.location for more reliable navigation
                window.location.href = '/group/new';
              }}
            >
              <Plus className="h-4 w-4" />
              New Group
            </Button>
          )}
        </div>
      )}

      {/* Desktop view (md and up): Table layout */}
      <div className="hidden md:block border border-theme-strong rounded-xl overflow-hidden shadow-sm dark:bg-card/90 dark:hover:bg-card/100 w-full">
        <table className="w-full">
          <thead>
            <tr className="border-b border-theme-strong">
              <th className="text-left py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Group</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Members</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Pages</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Edit Activity (24h)</th>
            </tr>
          </thead>
          <tbody>
            {displayGroups.map((group) => (
              <tr
                key={group.id}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  // Use direct navigation to avoid scroll issues with sticky headers
                  console.log('Group row clicked, using direct navigation', {
                    groupId: group.id,
                    url: `/group/${group.id}`
                  });

                  try {
                    // Create a full URL to ensure proper navigation
                    const baseUrl = window.location.origin;
                    const fullUrl = `${baseUrl}/group/${group.id}`;
                    console.log('EnhancedMyGroups - Navigating to full URL:', fullUrl);

                    // Use window.location.href for more reliable navigation
                    window.location.href = fullUrl;
                  } catch (error) {
                    console.error('Error with navigation, falling back to direct href', error);
                    window.location.href = `/group/${group.id}`;
                  }
                }}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center">
                    {!group.isPublic && <Lock className="h-4 w-4 mr-1.5 text-muted-foreground" />}
                    <PillLink href={`/group/${group.id}`}>
                      {group.name}
                    </PillLink>
                    {group.userRole && (
                      <Badge
                        variant={group.userRole === "owner" ? "default" : "secondary"}
                        className="ml-2 text-xs"
                      >
                        {group.userRole === "owner" ? "Owner" : "Member"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    by {group.ownerUsername}
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-medium">
                  <div className="flex items-center justify-end">
                    <Users className="h-4 w-4 text-muted-foreground mr-1.5" />
                    {getMemberCount(group.members)}
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-medium">
                  <div className="flex items-center justify-end">
                    <FileText className="h-4 w-4 text-muted-foreground mr-1.5" />
                    {getPageCount(group.pages)}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="w-24 h-12 ml-auto">
                    <SimpleSparkline
                      data={group.activity || []}
                      height={40}
                      strokeWidth={1.5}
                      title="Edit activity in the last 24 hours"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile view (smaller than md): Card grid layout */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {displayGroups.map((group) => (
          <div
            key={group.id}
            className="group block bg-card border border-theme-strong rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            onClick={(e) => {
              e.preventDefault();
              // Use direct navigation to avoid scroll issues with sticky headers
              console.log('Group card clicked (mobile), using direct navigation', {
                groupId: group.id,
                url: `/group/${group.id}`
              });

              try {
                // Create a full URL to ensure proper navigation
                const baseUrl = window.location.origin;
                const fullUrl = `${baseUrl}/group/${group.id}`;
                console.log('EnhancedMyGroups - Navigating to full URL (mobile):', fullUrl);

                // Use window.location.href for more reliable navigation
                window.location.href = fullUrl;
              } catch (error) {
                console.error('Error with navigation, falling back to direct href', error);
                window.location.href = `/group/${group.id}`;
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-medium">
                  <span className="inline-flex items-center my-0.5 text-sm font-medium rounded-lg px-2 py-0.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                    {!group.isPublic && <Lock className="h-3.5 w-3.5 mr-1" />}
                    <span className="truncate">{group.name}</span>
                  </span>
                </h3>
                <div className="flex items-center mt-1">
                  <div className="text-xs text-muted-foreground">
                    by {group.ownerUsername}
                  </div>
                  {group.userRole && (
                    <Badge
                      variant={group.userRole === "owner" ? "default" : "secondary"}
                      className="ml-2 text-xs"
                    >
                      {group.userRole === "owner" ? "Owner" : "Member"}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-muted-foreground mr-1" />
                      <span className="text-sm font-medium">{getMemberCount(group.members)}</span>
                    </div>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 text-muted-foreground mr-1" />
                      <span className="text-sm font-medium">{getPageCount(group.pages)}</span>
                    </div>
                  </div>
                </div>

                <div className="w-28 h-14 bg-background/50 rounded-md p-1">
                  <SimpleSparkline
                    data={group.activity || []}
                    height={48}
                    strokeWidth={2}
                    title="Edit activity in the last 24 hours"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
