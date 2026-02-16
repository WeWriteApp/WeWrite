import { useState, useCallback } from 'react';
import { useAdminData } from '../../../providers/AdminDataProvider';

export function useUserDrawer() {
  const { adminFetch } = useAdminData();
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [selectedUserData, setSelectedUserData] = useState<any>(null);
  const [loadingUserData, setLoadingUserData] = useState(false);

  const handleUserClick = useCallback(async (email: string) => {
    setSelectedUserEmail(email);
    setLoadingUserData(true);
    try {
      const response = await adminFetch(`/api/admin/users?search=${encodeURIComponent(email)}&includeFinancial=true&limit=1`);
      if (response.ok) {
        const result = await response.json();
        if (result.users && result.users.length > 0) {
          setSelectedUserData(result.users[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoadingUserData(false);
    }
  }, [adminFetch]);

  const closeUserDrawer = useCallback(() => {
    setSelectedUserEmail(null);
    setSelectedUserData(null);
  }, []);

  return {
    selectedUserEmail,
    selectedUserData,
    loadingUserData,
    handleUserClick,
    closeUserDrawer,
  };
}
