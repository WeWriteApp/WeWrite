"use client";

import React, { useState, useEffect } from 'react';
import { ChevronDown, User, Users, Loader, Check } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { updatePage } from '../../firebase/database';
import { rtdb } from '../../firebase/rtdb';
import { ref, get } from 'firebase/database';
import { toast } from '../ui/use-toast';

interface Group {
  id: string;
  name: string;
  isPublic?: boolean;
}

interface PageOwnershipDropdownProps {
  pageId: string;
  userId: string;
  username: string;
  groupId?: string | null;
  groupName?: string | null;
  onOwnershipChange?: (newGroupId: string | null, newGroupName: string | null) => void;
}

export default function PageOwnershipDropdown({
  pageId,
  userId,
  username,
  groupId,
  groupName,
  onOwnershipChange
}: PageOwnershipDropdownProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  // Fetch user's groups
  useEffect(() => {
    const fetchUserGroups = async () => {
      if (!userId) return;

      try {
        setIsLoading(true);

        // Get user's groups from RTDB
        const userGroupsRef = ref(rtdb, `users/${userId}/groups`);
        const userGroupsSnapshot = await get(userGroupsRef);

        if (!userGroupsSnapshot.exists()) {
          setGroups([]);
          setIsLoading(false);
          return;
        }

        const userGroupIds = Object.keys(userGroupsSnapshot.val());

        // Get group details
        const groupsData: Group[] = [];

        for (const groupId of userGroupIds) {
          const groupRef = ref(rtdb, `groups/${groupId}`);
          const groupSnapshot = await get(groupRef);

          if (groupSnapshot.exists()) {
            const groupData = groupSnapshot.val();
            groupsData.push({
              id: groupId,
              name: groupData.name,
              isPublic: groupData.isPublic
            });
          }
        }

        setGroups(groupsData);
      } catch (error) {
        console.error('Error fetching user groups:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your groups. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserGroups();
  }, [userId]);

  // Handle ownership change
  const handleOwnershipChange = async (newGroupId: string | null) => {
    if (newGroupId === groupId) {
      return;
    }

    try {
      setIsChanging(true);

      // Get the new group name if changing to a group
      let newGroupName = null;
      if (newGroupId) {
        const group = groups.find(g => g.id === newGroupId);
        newGroupName = group?.name || null;
      }

      // Update the page in Firestore
      await updatePage(pageId, {
        groupId: newGroupId,
        lastModified: new Date().toISOString()
      });

      // Call the onOwnershipChange callback if provided
      if (onOwnershipChange) {
        onOwnershipChange(newGroupId, newGroupName);
      }

      // Show success toast
      toast({
        title: 'Ownership updated',
        description: newGroupId
          ? `Page moved to "${newGroupName}" group`
          : `Page is now owned by you personally`,
        variant: 'default'
      });

    } catch (error) {
      console.error('Error changing page ownership:', error);
      toast({
        title: 'Error',
        description: 'Failed to update page ownership. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsChanging(false);
    }
  };

  // Return just the dropdown content, not the full dropdown
  // The parent component will handle the trigger and dropdown menu
  return (
    <>
      <DropdownMenuLabel>Page Ownership</DropdownMenuLabel>
      <DropdownMenuSeparator />

        {isLoading ? (
          <div className="flex justify-center items-center py-2">
            <Loader className="h-4 w-4 animate-spin mr-2" />
            <span>Loading groups...</span>
          </div>
        ) : (
          <>
            <DropdownMenuItem
              onClick={() => handleOwnershipChange(null)}
              className="gap-2"
              disabled={isChanging}
            >
              <User className="h-4 w-4" />
              <span>Personal ({username})</span>
              {!groupId && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>

            {groups.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Your Groups</DropdownMenuLabel>

                {groups.map(group => (
                  <DropdownMenuItem
                    key={group.id}
                    onClick={() => handleOwnershipChange(group.id)}
                    className="gap-2"
                    disabled={isChanging}
                  >
                    <Users className="h-4 w-4" />
                    <span>{group.name}</span>
                    {groupId === group.id && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </>
        )}
    </>
  );
}
