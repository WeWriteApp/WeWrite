import { useState, useEffect, useRef } from 'react';
import { contributorsService } from '../services/ContributorsService';
import { getUserContributorCount } from '../firebase/counters';

/**
 * Hook for managing contributor count with real-time updates
 * @param userId - The user ID to get contributor count for
 * @param enableRealTime - Whether to enable real-time updates (default: false)
 * @returns Object with count, loading state, and error state
 */
export const useContributorCount = (userId: string | null, enableRealTime: boolean = false) => {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchContributorCount = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (enableRealTime) {
          // Set up real-time listener
          const unsubscribe = contributorsService.subscribeToContributorCount(
            userId,
            (newCount) => {
              setCount(newCount);
              setIsLoading(false);
            }
          );

          if (unsubscribe) {
            unsubscribeRef.current = unsubscribe;
          } else {
            // Fallback to one-time fetch if real-time fails
            const staticCount = await getUserContributorCount(userId);
            setCount(staticCount);
            setIsLoading(false);
          }
        } else {
          // One-time fetch
          const staticCount = await getUserContributorCount(userId);
          setCount(staticCount);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching contributor count:', err);
        setError('Failed to load contributor count');
        setCount(0);
        setIsLoading(false);
      }
    };

    fetchContributorCount();

    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId, enableRealTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    count,
    isLoading,
    error,
    refresh: () => {
      if (userId) {
        getUserContributorCount(userId).then(setCount).catch(console.error);
      }
    }
  };
};
