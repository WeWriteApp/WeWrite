import { useEffect, useMemo, useState } from 'react';
import { adminFetch } from '../../../utils/adminFetch';
import { useMediaQuery } from '../../../hooks/use-media-query';
import { useGlobalDrawer } from '../../../providers/GlobalDrawerProvider';
import type { User, Activity, ActivityFilter } from '../types';

export function useUserDetails(
  users: User[],
  drawerSubPath?: string | null,
) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userActivities, setUserActivities] = useState<Activity[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [loadingActivities, setLoadingActivities] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { navigateInDrawer, isGlobalDrawerActive } = useGlobalDrawer();

  // Parse user ID from drawer subPath (e.g., "users/abc123" -> "abc123")
  const drawerUserIdMatch = drawerSubPath?.match(/^users\/(.+)$/);
  const drawerUserId = drawerUserIdMatch?.[1] || null;

  const refreshUserNotifications = async (uid: string, filter: ActivityFilter = 'all') => {
    setLoadingActivities(true);
    try {
      const res = await adminFetch(`/api/admin/users/activity?uid=${uid}&filter=${filter}&limit=30`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to load activity");
      setUserActivities(data.activities || []);
    } catch (err) {
      console.error("Admin users: failed to load activity", err);
      setUserActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (selectedUser?.uid) {
      refreshUserNotifications(selectedUser.uid, activityFilter);
    } else {
      setUserActivities([]);
    }
  }, [selectedUser?.uid, activityFilter]);

  // When viewing in drawer with a user ID, set selectedUser from users list
  useEffect(() => {
    if (drawerUserId && users.length > 0) {
      const user = users.find(u => u.uid === drawerUserId);
      if (user) {
        setSelectedUser(user);
      }
    }
  }, [drawerUserId, users]);

  const handleUserSelect = (user: User) => {
    if (isGlobalDrawerActive && !isDesktop) {
      navigateInDrawer(`admin/users/${user.uid}`);
    } else {
      setSelectedUser(user);
    }
  };

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'all') return userActivities;
    return userActivities.filter(a => a.type === activityFilter);
  }, [userActivities, activityFilter]);

  const isViewingUserDetails = drawerUserId && !isDesktop && isGlobalDrawerActive;

  return {
    selectedUser,
    setSelectedUser,
    userActivities,
    activityFilter,
    setActivityFilter,
    loadingActivities,
    isDesktop,
    isGlobalDrawerActive,
    drawerUserId,
    refreshUserNotifications,
    handleUserSelect,
    filteredActivities,
    isViewingUserDetails,
  };
}
