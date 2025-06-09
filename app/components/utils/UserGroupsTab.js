"use client";

import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../providers/AuthProvider';
import { Users, Plus, Loader, Lock, Globe, Crown, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { rtdb } from '../../firebase/config';

export default function UserGroupsTab({ profile }) {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const isCurrentUser = user && profile && user.uid === profile.uid;

  // Helper function to determine user's role in a group
  const getUserRole = (groupData, userId) => {
    if (groupData.owner === userId) {
      return 'owner';
    } else if (groupData.members && groupData.members[userId]) {
      return 'member';
    }
    return 'none';
  };

  // Helper function to get member count
  const getMemberCount = (groupData) => {
    if (!groupData.members) return 0;
    return Object.keys(groupData.members).length;
  };

  // Helper function to get page count
  const getPageCount = (groupData) => {
    if (!groupData.pages) return 0;
    return Object.keys(groupData.pages).length;
  };

  // Memoize the fetch function to avoid unnecessary re-renders
  const fetchUserGroups = useCallback(async () => {
      if (!profile?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get the viewed user's group memberships
        const viewedUserGroupsRef = ref(rtdb, `users/${profile.uid}/groups`);
        const viewedUserGroupsSnapshot = await get(viewedUserGroupsRef);

        if (!viewedUserGroupsSnapshot.exists()) {
          setGroups([]);
          setLoading(false);
          return;
        }

        const viewedUserGroupIds = Object.keys(viewedUserGroupsSnapshot.val());

        // Get current user's group memberships for privacy filtering
        let currentUserGroupIds = [];
        if (user?.uid && !isCurrentUser) {
          try {
            const currentUserGroupsRef = ref(rtdb, `users/${user.uid}/groups`);
            const currentUserGroupsSnapshot = await get(currentUserGroupsRef);
            if (currentUserGroupsSnapshot.exists()) {
              currentUserGroupIds = Object.keys(currentUserGroupsSnapshot.val());
            }
          } catch (err) {
            console.warn('Could not fetch current user groups for privacy filtering:', err);
            // Continue without current user groups - will only show public groups
          }
        }

        // Fetch group details for all groups the viewed user belongs to
        const groupPromises = viewedUserGroupIds.map(async (groupId) => {
          try {
            const groupRef = ref(rtdb, `groups/${groupId}`);
            const groupSnapshot = await get(groupRef);

            if (groupSnapshot.exists()) {
              const groupData = groupSnapshot.val();

              // Validate group data
              if (!groupData.name) {
                console.warn(`Group ${groupId} has no name, skipping`);
                return null;
              }

              // Apply privacy filtering
              if (isCurrentUser) {
                // Show all groups for current user
                return {
                  id: groupId,
                  ...groupData,
                  userRole: getUserRole(groupData, profile.uid)
                };
              } else {
                // For other users, apply privacy rules
                if (groupData.isPublic) {
                  // Show public groups
                  return {
                    id: groupId,
                    ...groupData,
                    userRole: getUserRole(groupData, profile.uid)
                  };
                } else {
                  // Show private groups only if current user is also a member
                  if (currentUserGroupIds.includes(groupId)) {
                    return {
                      id: groupId,
                      ...groupData,
                      userRole: getUserRole(groupData, profile.uid)
                    };
                  }
                  // Hide private groups where current user is not a member
                  return null;
                }
              }
            }
          } catch (err) {
            console.warn(`Error fetching group ${groupId}:`, err);
          }
          return null;
        });

        const groupResults = await Promise.all(groupPromises);
        const filteredGroups = groupResults.filter(group => group !== null);
        
        // Sort groups: owned groups first, then by name
        filteredGroups.sort((a, b) => {
          if (a.userRole === 'owner' && b.userRole !== 'owner') return -1;
          if (b.userRole === 'owner' && a.userRole !== 'owner') return 1;
          return (a.name || '').localeCompare(b.name || '');
        });

        setGroups(filteredGroups);
      } catch (err) {
        console.error('Error fetching user groups:', err);
        setError('Failed to load groups');
      } finally {
        setLoading(false);
      }
    }, [profile?.uid, user?.uid, isCurrentUser]);

  useEffect(() => {
    fetchUserGroups();
  }, [fetchUserGroups]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
          <Users className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="text-lg font-medium mb-2">Error Loading Groups</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-lg font-medium mb-2">
          {isCurrentUser ? "No Groups Yet" : "No Visible Groups"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          {isCurrentUser
            ? "You haven't joined any groups yet. Create or join a group to start collaborating!"
            : `${profile?.username || 'This user'} hasn't joined any public groups, or you don't share any private groups.`}
        </p>
        {isCurrentUser && (
          <div className="flex gap-2">
            <Link href="/groups">
              <Button variant="outline" className="gap-2">
                <Users className="h-4 w-4" />
                Browse Groups
              </Button>
            </Link>
            <Link href="/group/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Group
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {groups.length} group{groups.length !== 1 ? 's' : ''}
          {!isCurrentUser && ' visible to you'}
        </div>
        {isCurrentUser && (
          <div className="flex gap-2">
            <Link href="/groups">
              <Button variant="outline" size="sm" className="gap-2">
                <Users className="h-4 w-4" />
                View All
              </Button>
            </Link>
            <Link href="/group/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Group
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {groups.map((group) => (
          <Card 
            key={group.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => router.push(`/group/${group.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-foreground truncate">
                      {group.name}
                    </h3>
                    <div className="flex items-center gap-1">
                      {group.isPublic ? (
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                      {group.userRole === 'owner' && (
                        <Crown className="h-3 w-3 text-amber-500" />
                      )}
                    </div>
                  </div>
                  
                  {group.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {group.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {getMemberCount(group)} member{getMemberCount(group) !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {getPageCount(group)} page{getPageCount(group) !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <Badge 
                    variant={group.userRole === 'owner' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {group.userRole === 'owner' ? 'Owner' : 'Member'}
                  </Badge>
                  <Badge 
                    variant={group.isPublic ? 'outline' : 'secondary'}
                    className="text-xs"
                  >
                    {group.isPublic ? 'Public' : 'Private'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
