"use client";
import React, { useState, useEffect, useCallback, useContext } from "react";
import { rtdb } from "../../firebase/rtdb";
import { onValue, ref, get } from "firebase/database";
import { AuthContext } from "../../providers/AuthProvider";

export const GroupsContext = React.createContext();

export const GroupsProvider = ({ children }) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const auth = useContext(AuthContext);
  const user = auth?.user;

  // Function to fetch groups once
  const fetchGroups = useCallback(async () => {
    try {
      console.log('[DEBUG] GroupsProvider - Starting to fetch groups');
      setLoading(true);
      setError(null);

      // If user is not logged in, we don't need to fetch groups
      if (!user) {
        console.log('[DEBUG] GroupsProvider - No user, skipping groups fetch');
        setGroups([]);
        setLoading(false);
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
      const groupsData = [];
      for (const groupId of groupIds) {
        const groupRef = ref(rtdb, `groups/${groupId}`);
        const groupSnapshot = await get(groupRef);

        if (groupSnapshot.exists()) {
          const groupData = groupSnapshot.val();
          groupsData.push({
            id: groupId,
            ...groupData
          });
        }
      }

      setGroups(groupsData);
    } catch (err) {
      console.error("Error fetching groups:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch groups when user changes
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Provide a refresh function to manually update groups
  const refreshGroups = () => {
    fetchGroups();
  };

  return (
    <GroupsContext.Provider value={{ groups, loading, error, refreshGroups }}>
      {children}
    </GroupsContext.Provider>
  );
}