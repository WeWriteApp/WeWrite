"use client";
import { useState, useEffect, useContext, useCallback, useRef } from "react";
import Image from "next/image";
import { AuthContext } from "../providers/AuthProvider";
import { collection, getDocs, Timestamp, query, limit, getDoc, doc, startAfter, orderBy } from "firebase/firestore";
import { ref, onValue, get } from "firebase/database";
import { Trophy, Clock, ChevronRight, Info, AlertTriangle, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { rtdb } from "../firebase/rtdb";
import { db } from "../firebase/config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { PillLink } from "./PillLink";
import { SupporterIcon } from "./SupporterIcon";
import { db as firestoreDb } from "../firebase/database";
import SimpleSparkline from "./SimpleSparkline";
import { getBatchUserActivityLast24Hours } from "../firebase/userActivity";
import { generateCacheKey, getCacheItem, setCacheItem } from "../utils/cacheUtils";
import { trackQueryPerformance } from "../utils/queryMonitor";
import { ShimmerEffect } from "./ui/skeleton";

const UserListSkeleton = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Username</TableHead>
          <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap text-right">
            <div className="flex items-center justify-end gap-1">
              Pages
              <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </TableHead>
          <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap text-right">Activity (24h)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(8)].map((_, i) => (
          <TableRow key={i} className="animate-in fade-in-0" style={{ animationDelay: `${i * 50}ms` }}>
            <TableCell className="py-3 px-4">
              <ShimmerEffect className="inline-flex px-3 py-1.5 items-center gap-1 whitespace-nowrap rounded-[12px] border-[1.5px] border-muted/50 w-32 h-8" />
            </TableCell>
            <TableCell className="py-3 px-4 text-right">
              <ShimmerEffect className="h-4 w-8 rounded ml-auto" />
            </TableCell>
            <TableCell className="py-3 px-4 text-right">
              <ShimmerEffect className="w-24 h-8 rounded ml-auto" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const TopUsers = () => {
  // Core state
  const [allTimeUsers, setAllTimeUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState("");
  const { user } = useContext(AuthContext);
  const [sortDirection, setSortDirection] = useState("desc"); // "desc" or "asc"
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [userActivityData, setUserActivityData] = useState({});

  // Pagination state
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);

  // Caching and performance state
  const [isFreshData, setIsFreshData] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [loadTime, setLoadTime] = useState(null);

  // Refs for tracking performance
  const fetchStartTimeRef = useRef(null);
  const cachedDataRef = useRef(null);

  // Cache constants
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
  const CACHE_KEY = 'top-users';

  // Check if subscription feature is enabled
  useEffect(() => {
    const checkSubscriptionFeature = async () => {
      try {
        const featureFlagsRef = doc(firestoreDb, 'config', 'featureFlags');
        const featureFlagsDoc = await getDoc(featureFlagsRef);

        if (featureFlagsDoc.exists()) {
          const flagsData = featureFlagsDoc.data();
          setSubscriptionEnabled(flagsData.subscription_management === true);
        }
      } catch (error) {
        console.error('Error checking subscription feature flag:', error);
      }
    };

    checkSubscriptionFeature();
  }, []);

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === "desc" ? "asc" : "desc");
  };

  // Get sorted users with memoization to avoid unnecessary re-sorting
  const sortedUsers = [...allTimeUsers].sort((a, b) => {
    if (sortDirection === "desc") {
      return b.pageCount - a.pageCount;
    } else {
      return a.pageCount - b.pageCount;
    }
  });

  // Check cache and load data if available
  const checkCache = useCallback(() => {
    const cacheKey = generateCacheKey(CACHE_KEY, user?.uid || 'anonymous');
    const cachedData = getCacheItem(cacheKey);

    if (cachedData) {
      console.log('TopUsers: Using cached data', {
        timestamp: new Date(cachedData.timestamp).toISOString(),
        userCount: cachedData.users.length,
        activityDataCount: Object.keys(cachedData.activityData || {}).length
      });

      // Store in ref for comparison with fresh data
      cachedDataRef.current = cachedData;

      // Update state with cached data
      setAllTimeUsers(cachedData.users);
      setUserActivityData(cachedData.activityData || {});
      setLastUpdated(cachedData.timestamp);
      setIsFreshData(false);
      setLoading(false);

      // Calculate how old the data is
      const dataAge = Date.now() - cachedData.timestamp;
      console.log(`TopUsers: Cached data is ${Math.round(dataAge / 1000 / 60)} minutes old`);

      // If data is older than half the TTL, trigger a background refresh
      if (dataAge > CACHE_TTL / 2) {
        console.log('TopUsers: Cached data is getting stale, refreshing in background');
        refreshDataInBackground();
      }

      return true;
    }

    return false;
  }, [user?.uid]);

  // Refresh data in background without blocking UI
  const refreshDataInBackground = useCallback(() => {
    if (isBackgroundRefreshing) return;

    setIsBackgroundRefreshing(true);
    console.log('TopUsers: Starting background refresh');

    // Fetch fresh data
    fetchFreshData()
      .then(() => {
        console.log('TopUsers: Background refresh completed');
        setIsFreshData(true);
        setLastUpdated(Date.now());
      })
      .catch(err => {
        console.error('TopUsers: Background refresh failed:', err);
      })
      .finally(() => {
        setIsBackgroundRefreshing(false);
      });
  }, [isBackgroundRefreshing]);

  // Fetch fresh data and update cache
  const fetchFreshData = useCallback(async () => {
    console.log('TopUsers: Fetching fresh data');
    fetchStartTimeRef.current = performance.now();

    try {
      // We'll implement the optimized data fetching here in the next step
      // For now, this is a placeholder
      return fetchUsersAndPages();
    } catch (err) {
      console.error('TopUsers: Error fetching fresh data:', err);
      throw err;
    }
  }, [user]);

  // Optimized function to fetch users and pages with pagination
  const fetchUsersAndPages = useCallback(async (options = {}) => {
    const {
      useCachedData = true,
      isBackgroundFetch = false,
      page = 1,
      size = pageSize,
      startAfterDoc = null
    } = options;

    // If this is the initial load and not a background fetch, check cache first
    if (useCachedData && !isBackgroundFetch && page === 1) {
      const hasCachedData = checkCache();
      if (hasCachedData) {
        return; // Use cached data instead of fetching
      }
    }

    // Only show loading state if this is not a background fetch
    if (!isBackgroundFetch) {
      setLoading(true);
      setError(null);
      setErrorDetails("");
    }

    // Start performance tracking
    const fetchStartTime = performance.now();
    console.log(`TopUsers: Starting to fetch user and page data (page ${page}, size ${size})`);

    try {
      // Track this query for performance monitoring
      return await trackQueryPerformance('fetchTopUsers', async () => {
        // First, let's check if user auth state is available
        console.log("TopUsers: Current auth user state:", user ? `Logged in as ${user.email}` : "Not logged in");

        // Try to fetch users from RTDB with pagination
        console.log("TopUsers: Fetching users from RTDB");
        const usersRef = ref(rtdb, 'users');
        const usersSnapshot = await get(usersRef);

        if (!usersSnapshot.exists()) {
          console.log("TopUsers: No user data found in snapshot");
          if (!isBackgroundFetch) {
            setAllTimeUsers([]);
            setLoading(false);
          }
          return;
        }

        const userData = usersSnapshot.val();
        console.log(`TopUsers: Retrieved data for ${Object.keys(userData).length} users`);

        if (!userData) {
          console.log('TopUsers: No user data found');
          if (!isBackgroundFetch) {
            setAllTimeUsers([]);
            setLoading(false);
          }
          return;
        }

        // Create a lookup object to store page counts per user
        const pageCountsByUser = {};

        // Fetch page counts more efficiently using aggregation
        console.log("TopUsers: Fetching page counts from Firestore");

        // Use a more efficient query to get page counts
        const pagesCountQuery = query(
          collection(db, 'pages'),
          // We only need the userId field for counting
          limit(1000) // Limit to a reasonable number for performance
        );

        const pagesSnapshot = await getDocs(pagesCountQuery);
        console.log(`TopUsers: Retrieved ${pagesSnapshot.size} pages from Firestore`);

        // Count pages by user
        pagesSnapshot.forEach((doc) => {
          const pageData = doc.data();
          const userId = pageData.userId;

          if (userId) {
            // Increment page count for this user
            pageCountsByUser[userId] = (pageCountsByUser[userId] || 0) + 1;
          }
        });

        // Process users with pagination
        console.log("TopUsers: Processing user data");
        let allTimeUsersArray = await Promise.all(
          Object.entries(userData)
            .map(async ([id, userData]) => {
              // Get the username and remove @ symbol if present
              let username = userData.username || userData.displayName || "Unknown User";
              if (username.startsWith('@')) {
                username = username.substring(1);
              }

              // Fetch subscription information - only if needed
              let tier = null;
              let subscriptionStatus = null;

              if (subscriptionEnabled) {
                try {
                  const subscriptionDoc = await getDoc(doc(db, 'subscriptions', id));
                  if (subscriptionDoc.exists()) {
                    const subscriptionData = subscriptionDoc.data();
                    tier = subscriptionData.tier;
                    subscriptionStatus = subscriptionData.status;
                  }
                } catch (err) {
                  console.error(`Error fetching subscription for user ${id}:`, err);
                }
              }

              return {
                id,
                username,
                photoURL: userData.photoURL,
                pageCount: pageCountsByUser[id] || 0,
                tier,
                subscriptionStatus,
                lastActive: userData.lastActive || null
              };
            })
        );

        // Sort users by page count
        allTimeUsersArray = allTimeUsersArray
          .sort((a, b) => b.pageCount - a.pageCount);

        // Store total count before pagination
        const totalCount = allTimeUsersArray.length;

        // Apply pagination
        const startIndex = (page - 1) * size;
        const paginatedUsers = allTimeUsersArray.slice(startIndex, startIndex + size);

        console.log('TopUsers: Processed users:', {
          totalUsers: totalCount,
          paginatedUsers: paginatedUsers.length,
          page,
          size
        });

        // Fetch activity data only for the paginated users
        const userIds = paginatedUsers.map(user => user.id);
        let activityData = {};

        try {
          console.log('TopUsers: Fetching activity data for users:', userIds);
          activityData = await getBatchUserActivityLast24Hours(userIds);

          // Validate activity data
          Object.keys(activityData).forEach(userId => {
            const userData = activityData[userId];

            // Ensure we have valid hourly data
            if (!userData.hourly || !Array.isArray(userData.hourly) || userData.hourly.length !== 24) {
              console.warn(`TopUsers: Invalid activity data for user ${userId}, fixing`);
              activityData[userId] = {
                total: userData.total || 0,
                hourly: Array(24).fill(0)
              };
            }

            // Normalize negative values to zero
            if (userData.hourly) {
              activityData[userId].hourly = userData.hourly.map(val => Math.max(0, val));
            }
          });

          console.log('TopUsers: Activity data processed');
        } catch (activityError) {
          console.error('TopUsers: Error fetching user activity data:', activityError);
          // Continue with empty activity data rather than failing
          activityData = {};
        }

        // Calculate load time
        const fetchEndTime = performance.now();
        const timeElapsed = fetchEndTime - fetchStartTime;
        console.log(`TopUsers: Data fetch completed in ${timeElapsed.toFixed(2)}ms`);

        // Update state if this is not a background fetch
        if (!isBackgroundFetch) {
          setAllTimeUsers(paginatedUsers);
          setUserActivityData(activityData);
          setTotalUsers(totalCount);
          setHasMore(startIndex + size < totalCount);
          setLoading(false);
          setLoadTime(timeElapsed);
          setLastUpdated(Date.now());
          setIsFreshData(true);
        }

        // Cache the data
        const cacheKey = generateCacheKey(CACHE_KEY, user?.uid || 'anonymous');
        setCacheItem(cacheKey, {
          users: paginatedUsers,
          activityData,
          totalUsers: totalCount,
          hasMore: startIndex + size < totalCount,
          timestamp: Date.now(),
          loadTime: timeElapsed
        }, CACHE_TTL);

        return {
          users: paginatedUsers,
          activityData,
          totalUsers: totalCount,
          hasMore: startIndex + size < totalCount
        };
      }, { page, size });
    } catch (err) {
      console.error("TopUsers: Error fetching data:", err);

      if (!isBackgroundFetch) {
        setErrorDetails(`Error: ${err.message}`);
        setError(err);
        setLoading(false);
      }

      throw err;
    }
  }, [user, pageSize, checkCache, subscriptionEnabled]);

  // Load more users (pagination)
  const loadMoreUsers = useCallback(() => {
    if (loading || !hasMore) return;

    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);

    fetchUsersAndPages({
      page: nextPage,
      startAfterDoc: lastVisible
    });
  }, [currentPage, loading, hasMore, lastVisible, fetchUsersAndPages]);

  // Manual refresh function
  const refreshData = useCallback(() => {
    setLoading(true);
    fetchUsersAndPages({
      useCachedData: false,
      page: 1
    });
  }, [fetchUsersAndPages]);

  // Initial data load
  useEffect(() => {
    fetchUsersAndPages();
  }, [fetchUsersAndPages]);

  return (
    <div className="space-y-4">
      {/* All-time leaderboard */}
      <div className="space-y-4">

        <div className="border border-theme-medium rounded-lg overflow-hidden shadow-md dark:bg-card/90 dark:hover:bg-card/100 w-full">
          {/* Performance metrics (only in development) */}
          {process.env.NODE_ENV === 'development' && loadTime && (
            <div className="bg-muted/30 px-3 py-1 text-xs text-muted-foreground border-b border-border/30">
              <span>Load time: {loadTime.toFixed(2)}ms</span>
              {' | '}
              <span>Users: {totalUsers}</span>
              {' | '}
              <span>Cache: {isFreshData ? 'Fresh data' : 'From cache'}</span>
            </div>
          )}

          {loading && (
            <UserListSkeleton />
          )}

          {!loading && error && !user && (
            <div className="flex items-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
              <Info className="h-4 w-4 flex-shrink-0" />
              <p>Sign in to see the leaderboard</p>
            </div>
          )}

          {!loading && error && user && (
            <div className="p-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">There was a problem loading the leaderboard</p>
                  {errorDetails && <p className="mt-1 text-xs opacity-80">{errorDetails}</p>}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshData}
                    className="mt-2"
                  >
                    Try again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && allTimeUsers.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              <p>No supporters yet. Be the first to support a writer!</p>
            </div>
          )}

          {!loading && !error && allTimeUsers.length > 0 && (
            <>
              {/* Desktop view (md and larger): Table layout */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap">Username</TableHead>
                      <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap text-right cursor-pointer" onClick={toggleSortDirection}>
                        <div className="flex items-center justify-end gap-1">
                          <span className="mt-0.5">Pages</span>
                          {sortDirection === "desc" ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap text-right">Activity (24h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/user/${user.id}`}
                      >
                        <TableCell className="py-3 px-4">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PillLink
                                  href={`/user/${user.id}`}
                                  variant="primary"
                                  onClick={(e) => e.stopPropagation()} // Prevent double navigation
                                >
                                  <span className="flex items-center gap-1">
                                    {user.username || "Unknown User"}
                                    {subscriptionEnabled && (
                                      <SupporterIcon
                                        tier={user.tier}
                                        status={user.subscriptionStatus}
                                        size="sm"
                                      />
                                    )}
                                  </span>
                                </PillLink>
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>View user's pages</span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right font-medium">{user.pageCount}</TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <div className="w-24 h-8 ml-auto">
                            <SimpleSparkline
                              data={userActivityData[user.id]?.hourly || Array(24).fill(0)}
                              height={32}
                              strokeWidth={1.5}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination controls for desktop */}
                {hasMore && (
                  <div className="flex justify-center p-4 border-t border-border/30">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMoreUsers}
                      disabled={loading || !hasMore}
                      className="w-full max-w-xs"
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                          Loading...
                        </span>
                      ) : (
                        <span>Load more users</span>
                      )}
                    </Button>
                  </div>
                )}

                {/* Removed data freshness indicator and user count */}
              </div>

              {/* Mobile view (smaller than md): Card grid layout - removed container wrapper */}
              <div className="md:hidden grid grid-cols-1 gap-4 p-4">
                {sortedUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => window.location.href = `/user/${user.id}`}
                    style={{ cursor: 'pointer' }}
                    className="flex items-center justify-between p-4 bg-background hover:bg-muted/30 transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <PillLink
                        href={`/user/${user.id}`}
                        variant="primary"
                        onClick={(e) => e.stopPropagation()} // Prevent double navigation
                      >
                        <span className="flex items-center gap-1">
                          {user.username || "Unknown User"}
                          {subscriptionEnabled && (
                            <SupporterIcon
                              tier={user.tier}
                              status={user.subscriptionStatus}
                              size="sm"
                            />
                          )}
                        </span>
                      </PillLink>

                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="font-medium">{user.pageCount}</span>
                        <span className="text-xs">pages</span>
                      </div>
                    </div>

                    <div className="w-24 h-10">
                      <SimpleSparkline
                        data={userActivityData[user.id]?.hourly || Array(24).fill(0)}
                        height={40}
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                ))}

                {/* Mobile pagination */}
                {hasMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreUsers}
                    disabled={loading || !hasMore}
                    className="w-full mt-2"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      <span>Load more users</span>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* View All button */}
        {!loading && !error && allTimeUsers.length > 0 && (
          <div className="flex justify-center mt-4">
            <Link href="/users">
              <Button variant="outline">
                View all users
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopUsers;