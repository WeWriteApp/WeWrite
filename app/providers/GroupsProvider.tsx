"use client";
import React, { useState, useEffect, useCallback, useContext, ReactNode } from "react";
import { rtdb } from "../firebase/rtdb";
import { onValue, ref, get } from "firebase/database";
import { AuthContext } from "../providers/AuthProvider";

// Types
interface Group {
  id: string;
  name: string;
  description?: string;
  owner: string;
  members?: Record<string, boolean>;
  isPublic?: boolean;
  createdAt?: string;
  lastActivity?: string;
  [key: string]: any;
}

interface GroupsContextType {
  groups: Group[];
  loading: boolean;
  error: string | null;
  refreshGroups: () => void;
}

interface GroupsProviderProps {
  children: ReactNode;
}

export const GroupsContext = React.createContext<GroupsContextType | undefined>(undefined);

export const GroupsProvider = ({ children }: GroupsProviderProps) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const auth = useContext(AuthContext);
  const user = auth?.user;

  // Function to fetch groups once
  const fetchGroups = useCallback(async () => {
    try {
      console.log('[DEBUG] GroupsProvider - Starting to fetch groups');
      console.log('[DEBUG] GroupsProvider - Auth state:', {
        user: user ? { uid: user.uid, email: user.email } : null,
        authLoading: auth?.loading
      });

      setLoading(true);
      setError(null);

      // If user is not logged in, we don't need to fetch groups
      if (!user) {
        console.log('[DEBUG] GroupsProvider - No user, skipping groups fetch');
        setGroups([]);
        setLoading(false);
        return;
      }

      // Wait a bit to ensure auth is fully established
      if (auth?.loading) {
        console.log('[DEBUG] GroupsProvider - Auth still loading, waiting...');
        setTimeout(() => fetchGroups(), 500);
        return;
      }

      console.log('[DEBUG] GroupsProvider - Fetching groups for user:', user.uid);

      // Only fetch groups the user is a member of
      const userGroupsRef = ref(rtdb, `users/${user.uid}/groups`);
      console.log('[DEBUG] GroupsProvider - User groups reference:', userGroupsRef.toString());

      const userGroupsSnapshot = await get(userGroupsRef);
      console.log('[DEBUG] GroupsProvider - User groups snapshot exists:', userGroupsSnapshot.exists());

      if (!userGroupsSnapshot.exists()) {
        console.log('[DEBUG] GroupsProvider - No groups found for user');
        setGroups([]);
        setLoading(false);
        return;
      }

      console.log('[DEBUG] GroupsProvider - User groups data:', userGroupsSnapshot.val());

      const userGroups = userGroupsSnapshot.val();
      const groupIds = Object.keys(userGroups);

      // If user has no groups, return empty array
      if (groupIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Fetch only the groups the user is a member of
      const groupsData: Group[] = [];
      for (const groupId of groupIds) {
        try {
          console.log('[DEBUG] GroupsProvider - Fetching group:', groupId);
          const groupRef = ref(rtdb, `groups/${groupId}`);
          const groupSnapshot = await get(groupRef);

          if (groupSnapshot.exists()) {
            const groupData = groupSnapshot.val();
            console.log('[DEBUG] GroupsProvider - Group data for', groupId, ':', groupData);
            groupsData.push({
              id: groupId,
              ...groupData
            });
          } else {
            console.log('[DEBUG] GroupsProvider - Group', groupId, 'does not exist or no permission');
          }
        } catch (groupErr: any) {
          console.error('[DEBUG] GroupsProvider - Error fetching group', groupId, ':', groupErr);
        }
      }

      console.log('[DEBUG] GroupsProvider - Final groups data:', groupsData);
      setGroups(groupsData);
    } catch (err: any) {
      console.error("Error fetching groups:", err);
      console.error("Error details:", {
        code: err.code,
        message: err.message,
        stack: err.stack
      });
      setError(err.message || 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  }, [user, auth?.loading]);

  // Fetch groups when user changes
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Provide a refresh function to manually update groups
  const refreshGroups = (): void => {
    fetchGroups();
  };

  const value: GroupsContextType = {
    groups,
    loading,
    error,
    refreshGroups
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
}