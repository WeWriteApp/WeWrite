import { useState, useCallback } from "react";

// Types shared with leaderboard page
type UserLeaderboardCategory = 'pages-created' | 'links-received' | 'sponsors-gained' | 'page-views';
type PageLeaderboardCategory = 'new-supporters' | 'most-replies' | 'most-views' | 'most-links';

interface LeaderboardUser {
  userId: string;
  username: string;
  profilePicture?: string;
  count: number;
  rank: number;
}

interface LeaderboardPage {
  pageId: string;
  title: string;
  userId: string;
  username: string;
  count: number;
  rank: number;
}

const USER_CATEGORIES: UserLeaderboardCategory[] = ['pages-created', 'links-received', 'sponsors-gained', 'page-views'];
const PAGE_CATEGORIES: PageLeaderboardCategory[] = ['new-supporters', 'most-replies', 'most-views', 'most-links'];

const EMPTY_USER_DATA: Record<UserLeaderboardCategory, LeaderboardUser[]> = {
  'pages-created': [],
  'links-received': [],
  'sponsors-gained': [],
  'page-views': [],
};

const EMPTY_PAGE_DATA: Record<PageLeaderboardCategory, LeaderboardPage[]> = {
  'new-supporters': [],
  'most-replies': [],
  'most-views': [],
  'most-links': [],
};

export function useLeaderboardData(selectedMonth: string) {
  const [userData, setUserData] = useState<Record<UserLeaderboardCategory, LeaderboardUser[]>>(EMPTY_USER_DATA);
  const [pageData, setPageData] = useState<Record<PageLeaderboardCategory, LeaderboardPage[]>>(EMPTY_PAGE_DATA);
  const [userLoading, setUserLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [fullyLoadedCategories, setFullyLoadedCategories] = useState<Set<string>>(new Set());

  const fetchLeaderboards = useCallback(async (
    type: 'user' | 'page',
    fullLoad = false,
    specificCategory?: string
  ) => {
    const setLoading = type === 'user' ? setUserLoading : setPageLoading;
    const setError = type === 'user' ? setUserError : setPageError;
    const setData = type === 'user' ? setUserData : setPageData;
    const allCategories = type === 'user' ? USER_CATEGORIES : PAGE_CATEGORIES;

    if (!specificCategory) {
      setLoading(true);
    }
    setError(null);

    const limit = fullLoad ? 20 : 5;
    const categoriesToFetch = specificCategory
      ? allCategories.filter(c => c === specificCategory)
      : allCategories;

    try {
      const results = await Promise.all(
        categoriesToFetch.map(async (categoryId) => {
          const response = await fetch(
            `/api/leaderboard?type=${type}&category=${categoryId}&month=${selectedMonth}&limit=${limit}`
          );
          if (!response.ok) {
            throw new Error(`Failed to fetch ${categoryId} leaderboard`);
          }
          const data = await response.json();
          return { category: categoryId, data: data.data || [] };
        })
      );

      setData((prev: any) => {
        const newData = { ...prev };
        results.forEach(result => {
          newData[result.category] = result.data;
        });
        return newData;
      });

      if (fullLoad && specificCategory) {
        setFullyLoadedCategories(prev => new Set([...prev, `${type}-${specificCategory}`]));
      }
    } catch (err) {
      console.error(`Error fetching ${type} leaderboards:`, err);
      setError(`Unable to load ${type} leaderboards.`);
    } finally {
      if (!specificCategory) {
        setLoading(false);
      }
    }
  }, [selectedMonth]);

  const resetFullyLoaded = useCallback(() => {
    setFullyLoadedCategories(new Set());
  }, []);

  return {
    userData,
    pageData,
    userLoading,
    pageLoading,
    userError,
    pageError,
    fetchLeaderboards,
    fullyLoadedCategories,
    setFullyLoadedCategories,
    resetFullyLoaded,
  };
}
