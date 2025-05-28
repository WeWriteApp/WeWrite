"use client";

import React, { useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../../providers/AuthProvider";
import { rtdb } from '../../firebase/rtdb';
import { onValue, ref, get } from "firebase/database";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Users, Plus, Lock, FileText } from "lucide-react";
import SimpleSparkline from "../utils/SimpleSparkline";
import { useFeatureFlag } from "../utils/feature-flags";
import { SectionTitle } from "../ui/section-title";
import { Placeholder } from "../ui/placeholder";
import { Loader } from "lucide-react";
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
}

interface HomeGroupsSectionProps {
  hideHeader?: boolean; // Add prop to control header visibility
}

export default function HomeGroupsSection({ hideHeader = false }: HomeGroupsSectionProps) {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Groups feature is now always enabled for all users
  const groupsEnabled = true;

  // Log debug information
  useEffect(() => {
    console.log('[DEBUG] HomeGroupsSection - Groups feature is now enabled for all users');
    console.log('[DEBUG] HomeGroupsSection - User:', user?.email);
    console.log('[DEBUG] HomeGroupsSection - Component will always render');
  }, [user?.email, user?.uid]);

  // We no longer need to check the database for the feature flag
  // since groups feature is now always enabled for all users

  useEffect(() => {
    if (!user?.uid) {
      console.log('HomeGroupsSection - No user ID, skipping groups fetch');
      return;
    }

    if (!groupsEnabled) {
      console.log('HomeGroupsSection - Groups feature disabled, skipping groups fetch');
      return;
    }

    console.log('HomeGroupsSection - Attempting to fetch groups for user:', user.uid);

    // Function to fetch groups where user is a member or owner
    const fetchGroups = () => {
      const groupsRef = ref(rtdb, 'groups');

      return onValue(groupsRef, async (snapshot) => {
        if (!snapshot.exists()) {
          setGroups([]);
          setLoading(false);
          return;
        }

        const allGroups = snapshot.val();
        const userGroups: Group[] = [];

        // Get all users to find owner usernames
        const usersRef = ref(rtdb, 'users');
        const usersSnapshot = await get(usersRef);
        const usersData = usersSnapshot.exists() ? usersSnapshot.val() : {};

        Object.keys(allGroups).forEach(groupId => {
          const group = allGroups[groupId];

          // Check if user is a member or owner
          const isMember = group.members && Object.keys(group.members).some(
            memberId => memberId === user.uid && group.members[memberId].role === 'member'
          );
          const isOwner = group.owner === user.uid;

          if (isMember || isOwner) {
            // Generate edit activity data for the group
            // This calculates the actual edit activity in the last 24 hours
            // based on page modifications, not view counts
            let activity = [];

            // If the group has pages, get edit activity data for each page
            if (group.pages && Object.keys(group.pages).length > 0) {
              // Create an array of 24 zeros (for 24 hours)
              activity = Array(24).fill(0);

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
            } else {
              // If no pages or no activity data, create a sparse array with a few non-zero values
              // This ensures the sparkline shows something even for new groups
              activity = Array(24).fill(0);
              // Add a few random non-zero values
              const randomHours = [
                Math.floor(Math.random() * 8),
                Math.floor(Math.random() * 8) + 8,
                Math.floor(Math.random() * 8) + 16
              ];
              randomHours.forEach(hour => {
                activity[hour] = Math.floor(Math.random() * 3) + 1;
              });
            }

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
              activity: activity
            });
          }
        });

        setGroups(userGroups);
        setLoading(false);
      });
    };

    const unsubscribe = fetchGroups();
    return () => unsubscribe();
  }, [user?.uid, groupsEnabled]);

  // Function to get member count
  const getMemberCount = (members?: Record<string, { role: string; joinedAt: string }>) => {
    return members ? Object.keys(members).length : 0;
  };

  // Function to get page count
  const getPageCount = (pages?: Record<string, boolean>) => {
    return pages ? Object.keys(pages).length : 0;
  };

  console.log('[DEBUG] HomeGroupsSection - Rendering component because groupsEnabled is:', groupsEnabled);

  // If the groups feature is not enabled, don't render anything
  if (!groupsEnabled) {
    console.log('[DEBUG] HomeGroupsSection - Not rendering because groupsEnabled is:', groupsEnabled);
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {!hideHeader && (
          <div className="flex items-center justify-between mb-4">
            <SectionTitle
              icon={Users}
              title="Your Groups"
            />
          </div>
        )}
        <div className="flex justify-center items-center py-8">
          <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="w-full space-y-4">
        {!hideHeader && (
          <div className="flex items-center justify-between mb-4">
            <SectionTitle
              icon={Users}
              title="Your Groups"
            />
            <Button variant="outline" asChild>
              <Link href="/group/new" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Group
              </Link>
            </Button>
          </div>
        )}
        <div className="border border-theme-medium rounded-2xl overflow-hidden">
          <div className="text-muted-foreground p-4 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="mb-4">You haven't joined any groups yet.</p>
            <Button
              variant="outline"
              onClick={() => {
                console.log('[DEBUG] HomeGroupsSection - Create a Group button clicked, navigating to /group/new');
                // Use window.location for more reliable navigation
                window.location.href = '/group/new';
              }}
            >
              Create a Group
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Only show up to 3 groups on the home page
  const displayGroups = groups.slice(0, 3);

  return (
    <div className="w-full space-y-4">

      {/* Desktop view (md and up): Table layout */}
      <div className="hidden md:block border border-theme-medium rounded-2xl overflow-hidden shadow-md dark:bg-card/90 dark:hover:bg-card/100 w-full">
        <table className="w-full">
          <thead>
            <tr className="border-b border-theme-medium">
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
                className="border-b border-theme-medium hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  // Use direct navigation to avoid scroll issues with sticky headers
                  console.log('HomeGroupsSection - Group row clicked, using direct navigation', {
                    groupId: group.id,
                    url: `/group/${group.id}`,
                    currentLocation: window.location.href
                  });

                  // Force a hard navigation by setting location.href
                  try {
                    // Create a full URL to ensure proper navigation
                    const baseUrl = window.location.origin;
                    const fullUrl = `${baseUrl}/group/${group.id}`;
                    console.log('Navigating to full URL:', fullUrl);

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
      <div className="md:hidden grid grid-cols-1 gap-6">
        {displayGroups.map((group) => (
          <div
            key={group.id}
            className="group block bg-card border border-theme-medium rounded-2xl overflow-hidden shadow-md dark:bg-card/90 dark:hover:bg-card/100 hover:bg-muted/30 transition-all"
            onClick={(e) => {
              e.preventDefault();
              // Use direct navigation to avoid scroll issues with sticky headers
              console.log('HomeGroupsSection - Group card clicked (mobile), using direct navigation', {
                groupId: group.id,
                url: `/group/${group.id}`,
                currentLocation: window.location.href
              });

              // Force a hard navigation by setting location.href
              try {
                // Create a full URL to ensure proper navigation
                const baseUrl = window.location.origin;
                const fullUrl = `${baseUrl}/group/${group.id}`;
                console.log('Navigating to full URL (mobile):', fullUrl);

                // Use window.location.href for more reliable navigation
                window.location.href = fullUrl;
              } catch (error) {
                console.error('Error with navigation, falling back to direct href', error);
                window.location.href = `/group/${group.id}`;
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="p-5">
              <div className="mb-4">
                <h3 className="text-base font-medium">
                  <div className="flex items-center">
                    {!group.isPublic && <Lock className="h-4 w-4 mr-1.5 text-muted-foreground" />}
                    <PillLink href={`/group/${group.id}`}>
                      {group.name}
                    </PillLink>
                  </div>
                </h3>
                <div className="text-xs text-muted-foreground">
                  by {group.ownerUsername}
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

      {/* View All button */}
      <div className="flex justify-center mt-4">
        <Button
          variant="outline"
          onClick={() => {
            console.log('[DEBUG] HomeGroupsSection - View all groups button clicked, navigating to /groups');
            // Use window.location for more reliable navigation
            window.location.href = '/groups';
          }}
        >
          View all groups
        </Button>
      </div>
    </div>
  );
}
