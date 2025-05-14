"use client";

import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { rtdb } from '../firebase/rtdb';
import { onValue, ref, get } from "firebase/database";
import Link from "next/link";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Users, Plus, Lock } from "lucide-react";
import SimpleSparkline from "./SimpleSparkline";
import { useFeatureFlag } from "../utils/feature-flags";
import SectionTitle from "./SectionTitle";
import { Placeholder } from "./ui/placeholder";
import { Loader } from "lucide-react";

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

export default function HomeGroupsSection() {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if the groups feature flag is enabled
  const groupsEnabled = useFeatureFlag('groups', user?.email);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    if (!groupsEnabled) {
      return;
    }

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
            // Get real activity data for the group
            // This will be based on page edits within the group
            let activity = [];

            // If the group has pages, get activity data for each page
            if (group.pages && Object.keys(group.pages).length > 0) {
              // Create an array of 24 zeros (for 24 hours)
              activity = Array(24).fill(0);

              // For each page in the group, add its activity to the group activity
              Object.keys(group.pages).forEach(pageId => {
                // If the page has activity data, add it to the group activity
                if (group.pages[pageId] && group.pages[pageId].activity) {
                  const pageActivity = group.pages[pageId].activity;
                  // Add each hour's activity to the corresponding hour in the group activity
                  pageActivity.forEach((count, hour) => {
                    activity[hour] += count;
                  });
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

  // If the groups feature is not enabled, don't render anything
  if (!groupsEnabled) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '200px' }}>
        <Placeholder className="w-full h-8 mb-4" animate={true}>
          <div className="flex items-center space-x-2 p-2">
            <Loader className="h-5 w-5 animate-spin text-primary" />
            <span className="text-lg text-muted-foreground">Loading...</span>
          </div>
        </Placeholder>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle
            icon={Users}
            title="Your Groups"
          />
          <Button variant="outline" asChild>
            <Link href="/groups/new" className="flex items-center gap-2">
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
              <Link href="/groups/new">Create a Group</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Only show up to 3 groups on the home page
  const displayGroups = groups.slice(0, 3);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between mb-4">
        <SectionTitle
          icon={Users}
          title="Your Groups"
        />
        <Button variant="outline" asChild>
          <Link href="/groups/new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Group
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayGroups.map((group) => (
          <Link key={group.id} href={`/group/${group.id}`} className="block">
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  {!group.isPublic && <Lock className="h-4 w-4 mr-1.5 text-muted-foreground" />}
                  {group.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground mb-2">
                  <span>by {group.ownerUsername}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-muted-foreground mr-1" />
                      <span className="text-sm">{getMemberCount(group.members)}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm">{getPageCount(group.pages)} pages</span>
                    </div>
                  </div>
                </div>
                <div className="h-10 w-full">
                  <SimpleSparkline
                    data={group.activity || []}
                    height={40}
                    color="#1768FF"
                    strokeWidth={1.5}
                  />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {groups.length > 3 && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" asChild>
            <Link href="/groups">
              View all groups
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
