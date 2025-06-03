"use client";
import { useState, useEffect, useContext, useCallback, useRef, useMemo } from "react";
import { AuthContext } from "../../providers/AuthProvider";
import { collection, getDocs, query, limit, getDoc, doc, where } from "firebase/firestore";
import { ref, get } from "firebase/database";
import { Info, AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import { rtdb } from "../../firebase/rtdb";
import { db } from "../../firebase/config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import PillLink from "../utils/PillLink";
import { SupporterIcon } from "../payments/SupporterIcon";
import { db as firestoreDb } from "../../firebase/database";
import SimpleSparkline from "../utils/SimpleSparkline";
import { useFeatureFlag } from "../../utils/feature-flags";
import { getBatchUserActivityLast24Hours } from "../../firebase/userActivity";
import { generateCacheKey, getCacheItem, setCacheItem } from "../../utils/cacheUtils";
import { trackQueryPerformance } from "../../utils/queryMonitor";
import { getBatchUserData } from "../../firebase/batchUserData";
import { ShimmerEffect } from "../ui/skeleton";

import { getUserPageCount } from "../../firebase/counters";

// UserListSkeleton component removed as it's no longer needed

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
  const [pageSize] = useState(8); // Used in fetchUsersAndPages options
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalUsers, setTotalUsers] = useState(0);
  const [lastVisible] = useState(null); // Used in loadMoreUsers

  // Caching and performance state
  const [isFreshData, setIsFreshData] = useState(true);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [loadTime, setLoadTime] = useState(null);

  // Refs for tracking performance
  const fetchStartTimeRef = useRef(null);
  const cachedDataRef = useRef(null);

  // Cache constants - CRITICAL FIX: Reduce cache time for more real-time activity data
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds (reduced from 1 hour)
  const CACHE_KEY = 'top-users';

  // Check if subscription feature is enabled
  useEffect(() => {
    const checkSubscriptionFeature = async () => {
      try {
        const featureFlagsRef = doc(firestoreDb, 'config', 'featureFlags');
        const featureFlagsDoc = await getDoc(featureFlagsRef);

        if (featureFlagsDoc.exists()) {
          const flagsData = featureFlagsDoc.data();
          setSubscriptionEnabled(flagsData.payments === true);
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

  // Get sorted users with proper memoization to avoid unnecessary re-sorting
  const sortedUsers = useMemo(() => {
    return [...allTimeUsers].sort((a, b) => {
      if (sortDirection === "desc") {
        return b.pageCount - a.pageCount;
      } else {
        return a.pageCount - b.pageCount;
      }
    });
  }, [allTimeUsers, sortDirection]);

  // Optimized function to fetch users and pages with pagination
  const fetchUsersAndPages = useCallback(async (options = {}) => {
    const {
      useCachedData = true,
      isBackgroundFetch = false,
      page = 1,
      size = pageSize
      // startAfterDoc removed as it's not used
    } = options;

    // If this is the initial load and not a background fetch, check cache first
    if (useCachedData && !isBackgroundFetch && page === 1) {
      // Check cache directly without triggering background refresh to prevent recursion
      const cacheKey = generateCacheKey(CACHE_KEY, user?.uid || 'anonymous');
      const cachedData = getCacheItem(cacheKey);

      if (cachedData) {
        console.log('TopUsers: Using cached data in fetchUsersAndPages');

        // Update state with cached data
        setAllTimeUsers(cachedData.users);
        setUserActivityData(cachedData.activityData || {});
        setIsFreshData(false);
        setLoading(false);

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

        // OPTIMIZATION: Use batch user data fetching for better performance
        console.log("TopUsers: Processing user data with optimized batch fetching");

        const userEntries = Object.entries(userData);
        const userIds = userEntries.map(([id]) => id);

        // Batch fetch all user data including subscriptions
        console.log(`TopUsers: Batch fetching data for ${userIds.length} users`);
        const batchUserData = await getBatchUserData(userIds);

        // Process users with batch data and page counts
        let allTimeUsersArray = [];
        const BATCH_SIZE = 10; // Process page counts in batches to avoid overwhelming the database

        for (let i = 0; i < userEntries.length; i += BATCH_SIZE) {
          const batch = userEntries.slice(i, i + BATCH_SIZE);
          console.log(`TopUsers: Processing page counts for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(userEntries.length / BATCH_SIZE)}`);

          const batchResults = await Promise.all(
            batch.map(async ([id, rtdbUserData]) => {
              // Get user data from batch fetch (includes subscription info)
              const batchedUser = batchUserData[id];

              // Get the username and remove @ symbol if present
              let username = batchedUser?.username || rtdbUserData.username || rtdbUserData.displayName || "Unknown User";
              if (username.startsWith('@')) {
                username = username.substring(1);
              }

              // Fetch page count using the same function as user profiles for consistency
              let pageCount = 0;
              try {
                pageCount = await getUserPageCount(id, user?.uid);
              } catch (err) {
                console.error(`Error fetching page count for user ${id}:`, err);
              }

              return {
                id,
                username,
                photoURL: rtdbUserData.photoURL || batchedUser?.photoURL,
                pageCount,
                tier: batchedUser?.tier || null,
                subscriptionStatus: batchedUser?.subscriptionStatus || null,
                lastActive: rtdbUserData.lastActive || null
              };
            })
          );

          allTimeUsersArray.push(...batchResults);

          // Add small delay between batches to prevent overwhelming the database
          if (i + BATCH_SIZE < userEntries.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

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
        const paginatedUserIds = paginatedUsers.map(user => user.id);
        let activityData = {};

        try {
          console.log('TopUsers: Fetching activity data for users:', paginatedUserIds);
          activityData = await getBatchUserActivityLast24Hours(paginatedUserIds);

          // CRITICAL FIX: Add detailed logging for debugging activity data
          console.log('TopUsers: Raw activity data received:', activityData);

          // Count total activities across all users for debugging
          const totalActivitiesFound = Object.values(activityData).reduce((sum, userData) => {
            return sum + (userData.total || 0);
          }, 0);
          console.log(`TopUsers: Total activities found across all users: ${totalActivitiesFound}`);

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

            // CRITICAL FIX: Log individual user activity for debugging
            if (userData.total > 0) {
              console.log(`TopUsers: User ${userId} has ${userData.total} activities in last 24h`);
            }
          });

          console.log('TopUsers: Activity data processed and validated');
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
  }, [user, pageSize, subscriptionEnabled]);

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
      setIsFreshData(false);
      setLoading(false);

      // Calculate how old the data is
      const dataAge = Date.now() - cachedData.timestamp;
      console.log(`TopUsers: Cached data is ${Math.round(dataAge / 1000 / 60)} minutes old`);

      // Store the data age in a ref so we can check it later
      if (dataAge > CACHE_TTL / 2) {
        console.log('TopUsers: Cached data is getting stale, will refresh in background');
        // Set a flag to trigger background refresh after component mounts
        setTimeout(() => {
          if (!isBackgroundRefreshing) {
            setIsBackgroundRefreshing(true);
            console.log('TopUsers: Starting background refresh');

            fetchUsersAndPages({
              useCachedData: false,
              isBackgroundFetch: true
            })
              .then(() => {
                console.log('TopUsers: Background refresh completed');
                setIsFreshData(true);
              })
              .catch(err => {
                console.error('TopUsers: Background refresh failed:', err);
              })
              .finally(() => {
                setIsBackgroundRefreshing(false);
              });
          }
        }, 100);
      }

      return true;
    }

    return false;
  }, [user?.uid, isBackgroundRefreshing, fetchUsersAndPages]);

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
    <>
      {/* Desktop view container */}
      <div className="hidden md:block space-y-4">
        {/* All-time leaderboard */}
        <div className="space-y-4">
          <div className="border border-theme-medium rounded-2xl overflow-hidden shadow-md dark:bg-card/90 dark:hover:bg-card/100 w-full">
            {/* Performance metrics (only in development) */}
            {process.env.NODE_ENV === 'development' && loadTime && (
              <div className="bg-muted/30 px-3 py-1 text-xs text-muted-foreground border-b border-border/30 flex items-center justify-between">
                <div>
                  <span>Load time: {loadTime.toFixed(2)}ms</span>
                  {' | '}
                  <span>Users: {totalUsers}</span>
                  {' | '}
                  <span>Cache: {isFreshData ? 'Fresh data' : 'From cache'}</span>
                </div>

              </div>
            )}

            {loading && (
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap text-left w-1/2">Username</TableHead>
                      <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap w-1/4" style={{ textAlign: "center" }}>
                        Pages
                      </TableHead>
                      <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap text-right w-1/4">Activity (24h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(8)].map((_, i) => (
                      <TableRow key={i} className="animate-in fade-in-0" style={{ animationDelay: `${i * 50}ms` }}>
                        <TableCell className="py-3 px-4 text-left w-1/2">
                          <ShimmerEffect className="inline-flex px-3 py-1.5 items-center gap-1 whitespace-nowrap rounded-[12px] border-[1.5px] border-muted/50 w-32 h-8" />
                        </TableCell>
                        <TableCell className="py-3 px-4 w-1/4" style={{ textAlign: "center" }}>
                          <div className="flex justify-center">
                            <ShimmerEffect className="h-4 w-8 rounded" />
                          </div>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right w-1/4">
                          <ShimmerEffect className="w-24 h-8 rounded ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap text-left w-1/2">Username</TableHead>
                      <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap cursor-pointer w-1/4" style={{ textAlign: "center" }} onClick={toggleSortDirection}>
                        Pages {sortDirection === "desc" ? "↓" : "↑"}
                      </TableHead>
                      <TableHead className="py-2 px-4 font-medium text-muted-foreground text-sm whitespace-nowrap text-right w-1/4">Activity (24h)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUsers.map((user) => (
                      <TableRow
                        key={user.id}
                        className="border-b border-theme-strong hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/user/${user.id}`}
                      >
                        <TableCell className="py-3 px-4 text-left w-1/2">
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
                                    {false && subscriptionEnabled && (
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
                        <TableCell className="py-3 px-4 font-medium w-1/4" style={{ textAlign: "center" }}>
                          {user.pageCount}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right w-1/4">
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
                  <div className="flex justify-center p-4 border-t border-theme-strong">
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
              </div>
            )}
          </div>

          {/* View All button - desktop only */}
          {!loading && !error && allTimeUsers.length > 0 && (
            <div className="hidden md:flex justify-center mt-4">
              <Link href="/users">
                <Button variant="outline">
                  View all users
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile loading skeleton - direct children without container */}
      {loading && [...Array(8)].map((_, i) => (
        <div
          key={i}
          className="md:hidden flex items-center justify-between p-5 border border-theme-strong rounded-xl shadow-sm dark:bg-card/90 dark:hover:bg-card/100 hover:bg-muted/30 transition-colors mb-6"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <ShimmerEffect className="inline-flex px-3 py-1.5 items-center gap-1 whitespace-nowrap rounded-[12px] border-[1.5px] border-muted/50 w-32 h-8" />
            <ShimmerEffect className="h-4 w-12 rounded" />
          </div>
          <ShimmerEffect className="w-24 h-10 rounded" />
        </div>
      ))}

      {/* Mobile error states */}
      {!loading && error && !user && (
        <div className="md:hidden flex items-center gap-2 p-4 text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl mb-4">
          <Info className="h-4 w-4 flex-shrink-0" />
          <p>Sign in to see the leaderboard</p>
        </div>
      )}

      {!loading && error && user && (
        <div className="md:hidden p-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-xl mb-4">
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
        <div className="md:hidden p-4 text-sm text-muted-foreground text-center rounded-xl border border-theme-strong mb-4">
          <p>No supporters yet. Be the first to support a writer!</p>
        </div>
      )}

      {/* Mobile view cards - direct children without container */}
      {!loading && !error && allTimeUsers.length > 0 && sortedUsers.map((user) => (
        <div
          key={user.id}
          onClick={() => window.location.href = `/user/${user.id}`}
          className="md:hidden flex items-center justify-between p-5 border border-theme-strong rounded-xl shadow-sm dark:bg-card/90 dark:hover:bg-card/100 hover:bg-muted/30 transition-colors mb-6"
        >
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            <PillLink
              href={`/user/${user.id}`}
              variant="primary"
              onClick={(e) => e.stopPropagation()} // Prevent double navigation
              className="max-w-[200px] truncate"
            >
              <span className="flex items-center gap-1">
                {user.username || "Unknown User"}
                {false && subscriptionEnabled && (
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

          <div className="w-24 h-10 flex-shrink-0">
            <SimpleSparkline
              data={userActivityData[user.id]?.hourly || Array(24).fill(0)}
              height={40}
              strokeWidth={1.5}
            />
          </div>
        </div>
      ))}

      {/* Mobile pagination - direct child without container */}
      {!loading && !error && allTimeUsers.length > 0 && hasMore && (
        <Button
          variant="outline"
          size="sm"
          onClick={loadMoreUsers}
          disabled={loading || !hasMore}
          className="md:hidden w-full mb-4 rounded-xl border border-theme-strong shadow-sm hover:shadow-md transition-shadow"
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

      {/* Mobile View All button */}
      {!loading && !error && allTimeUsers.length > 0 && (
        <div className="md:hidden flex justify-center mb-4">
          <Link href="/users">
            <Button variant="outline" className="rounded-xl border border-theme-strong shadow-sm hover:shadow-md transition-shadow">
              View all users
            </Button>
          </Link>
        </div>
      )}
    </>
  );
};

export default TopUsers;