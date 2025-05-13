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
  const [debugInfo, setDebugInfo] = useState<{flag: boolean, error?: string}>({ flag: false });

  // Check if the groups feature flag is enabled
  const groupsEnabled = useFeatureFlag('groups', user?.email);

  // Add direct check for feature flag for debugging
  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase/database');

        const featureFlagsRef = doc(db, 'config', 'featureFlags');
        const featureFlagsDoc = await getDoc(featureFlagsRef);

        if (featureFlagsDoc.exists()) {
          const flagsData = featureFlagsDoc.data();
          const isEnabled = flagsData['groups'] === true;
          console.log('HomeGroupsSection - Direct check - Groups feature flag:', isEnabled);
          setDebugInfo({ flag: isEnabled });
        } else {
          console.log('HomeGroupsSection - No feature flags document found');
          setDebugInfo({ flag: false, error: 'No feature flags document found' });
        }
      } catch (error) {
        console.error('HomeGroupsSection - Error checking groups feature flag:', error);
        setDebugInfo({ flag: false, error: String(error) });
      }
    };

    checkFeatureFlag();
  }, []);

  useEffect(() => {
    console.log('HomeGroupsSection - useFeatureFlag hook value:', groupsEnabled);
    console.log('HomeGroupsSection - User:', user?.uid, user?.email);

    if (!user?.uid) {
      console.log('HomeGroupsSection - No user ID, not fetching groups');
      return;
    }

    if (!groupsEnabled) {
      console.log('HomeGroupsSection - Groups feature disabled, not fetching groups');
      return;
    }

    console.log('HomeGroupsSection - Fetching groups for user:', user.uid);

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
            // Generate mock activity data for the sparkline
            // In a real implementation, this would come from actual group activity
            const activity = Array.from({ length: 24 }, () => Math.floor(Math.random() * 10));

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

  // If the groups feature is not enabled, show debug info for admin
  if (!groupsEnabled) {
    if (user?.email === 'jamiegray2234@gmail.com') {
      return (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Groups Feature Debug</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Feature Flag Status:</h3>
                <p>useFeatureFlag hook: {groupsEnabled ? 'Enabled' : 'Disabled'}</p>
                <p>Direct check: {debugInfo.flag ? 'Enabled' : 'Disabled'}</p>
                {debugInfo.error && (
                  <p className="text-red-500">Error: {debugInfo.error}</p>
                )}
              </div>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
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
          <Link key={group.id} href={`/groups/${group.id}`} className="block">
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
