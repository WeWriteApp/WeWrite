"use client";

import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { rtdb } from '../firebase/rtdb';
import { onValue, ref, get } from "firebase/database";
import Link from "next/link";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ChevronRight, Users, FileText, Plus, Lock } from "lucide-react";
import { useMediaQuery } from "../hooks/use-media-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import SimpleSparkline from "./SimpleSparkline";
import PillLink from "./PillLink";

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

export default function EnhancedMyGroups({ profileUserId }: { profileUserId?: string }) {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    if (!user?.uid) return;

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
        });

        setGroups(userGroups);
        setLoading(false);
      });
    };

    const unsubscribe = fetchGroups();
    return () => unsubscribe();
  }, [user?.uid, profileUserId]);

  // Function to generate activity data for a group
  const generateActivityData = (group: any): number[] => {
    // If the group has real activity data, use it
    if (group.activity && Array.isArray(group.activity)) {
      return group.activity;
    }

    // Otherwise, create a sparse array with a few non-zero values
    // This ensures the sparkline shows something even for new groups
    const activity = Array(24).fill(0);
    
    // Add a few random non-zero values
    const randomHours = [
      Math.floor(Math.random() * 8),
      Math.floor(Math.random() * 8) + 8,
      Math.floor(Math.random() * 8) + 16
    ];
    
    randomHours.forEach(hour => {
      activity[hour] = Math.floor(Math.random() * 3) + 1;
    });
    
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
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center">
            <Users className="h-5 w-5 mr-2" />
            My Groups
          </h2>
        </div>
        <div className="flex justify-center items-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold flex items-center">
            <Users className="h-5 w-5 mr-2" />
            My Groups
          </h2>
          <Button variant="outline" asChild>
            <Link href="/group/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Group
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">You haven't joined any groups yet.</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/group/new">Create a Group</Link>
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold flex items-center">
          <Users className="h-5 w-5 mr-2" />
          My Groups
        </h2>
        {!profileUserId && (
          <Button variant="outline" asChild>
            <Link href="/group/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Group
            </Link>
          </Button>
        )}
      </div>

      {/* Desktop view (md and up): Table layout */}
      <div className="hidden md:block border border-theme-medium rounded-lg overflow-hidden shadow-md dark:bg-card/90 dark:hover:bg-card/100 w-full">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Group</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Members</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Pages</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Activity</th>
            </tr>
          </thead>
          <tbody>
            {displayGroups.map((group) => (
              <tr
                key={group.id}
                className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `/group/${group.id}`;
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
            className="group block bg-card border border-border rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = `/group/${group.id}`;
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
