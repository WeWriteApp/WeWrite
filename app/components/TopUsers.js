"use client";
import { useState, useEffect, useContext } from "react";
import Image from "next/image";
import { AuthContext } from "../providers/AuthProvider";
import { collection, getDocs, Timestamp, query, limit, getDoc, doc } from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { Trophy, Clock, ChevronRight, Info, AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { rtdb } from "../firebase/rtdb";
import { db } from "../firebase/config";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { PillLink } from "./PillLink";
import { SupporterIcon } from "./SupporterIcon";
import { db as firestoreDb } from "../firebase/database";

const UserListSkeleton = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Username</TableHead>
          <TableHead className="text-right">
            <div className="flex items-center justify-end gap-1">
              Pages
              <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(8)].map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="inline-flex px-3 py-1.5 items-center gap-1 whitespace-nowrap rounded-[12px] bg-muted animate-pulse border-[1.5px] border-muted/50 w-32 h-8"></div>
            </TableCell>
            <TableCell className="text-right">
              <div className="h-4 w-8 bg-muted animate-pulse rounded ml-auto"></div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const TopUsers = () => {
  const [allTimeUsers, setAllTimeUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState("");
  const { user } = useContext(AuthContext);
  const [sortDirection, setSortDirection] = useState("desc"); // "desc" or "asc"
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);

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

  const sortedUsers = [...allTimeUsers].sort((a, b) => {
    if (sortDirection === "desc") {
      return b.pageCount - a.pageCount;
    } else {
      return a.pageCount - b.pageCount;
    }
  });

  useEffect(() => {
    const fetchUsersAndPages = async () => {
      console.log("TopUsers: Starting to fetch user and page data");
      setLoading(true);
      setError(null);
      setErrorDetails("");

      try {
        // First, let's check if user auth state is available
        console.log("TopUsers: Current auth user state:", user ? `Logged in as ${user.email}` : "Not logged in");

        // Try to fetch users from RTDB
        console.log("TopUsers: Attempting to fetch users from RTDB");
        const usersRef = ref(rtdb, 'users');

        try {
          console.log("TopUsers: Listening for changes to users ref");
          onValue(usersRef, (snapshot) => {
            console.log("TopUsers: Got snapshot, exists:", snapshot.exists());

            if (!snapshot.exists()) {
              console.log("TopUsers: No user data found in snapshot");
              setAllTimeUsers([]);
              setLoading(false);
              return;
            }

            const data = snapshot.val();
            console.log(`TopUsers: Retrieved data for ${Object.keys(data).length} users`);

            if (data) {
              // Create a lookup object to store page counts per user
              const pageCountsByUser = {};

              // Now try to get pages from Firestore
              console.log("TopUsers: Attempting to fetch pages from Firestore");
              const pagesRef = collection(db, 'pages');
              // No limit here to get accurate page counts

              try {
                // Use an async IIFE to be able to use await inside the onValue callback
                (async () => {
                  const pagesSnapshot = await getDocs(pagesRef);

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

                  console.log("TopUsers: Processing user data");
                  // Process users for all-time leaderboard
                  const allTimeUsersArray = await Promise.all(Object.entries(data).map(async ([id, userData]) => {
                    // Get the username and remove @ symbol if present
                    let username = userData.username || userData.displayName || "Unknown User";
                    if (username.startsWith('@')) {
                      username = username.substring(1);
                    }

                    // Fetch subscription information
                    let tier = null;
                    let subscriptionStatus = null;
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

                    return {
                      id,
                      username,
                      photoURL: userData.photoURL,
                      pageCount: pageCountsByUser[id] || 0,
                      tier,
                      subscriptionStatus
                    };
                  }));

                  // Sort users by page count (including users with 0 pages)
                  const sortedAllTimeUsers = allTimeUsersArray
                    .sort((a, b) => b.pageCount - a.pageCount)
                    .slice(0, 8); // Show only top 8 users

                  console.log('TopUsers: Processed users:', {
                    allTimeUserCount: sortedAllTimeUsers.length,
                  });

                  setAllTimeUsers(sortedAllTimeUsers);
                  setLoading(false);
                  setError(null);
                })().catch(innerFirestoreErr => {
                  console.error("TopUsers: Error processing Firestore data:", innerFirestoreErr);
                  // Continue with empty data rather than failing
                  console.log("TopUsers: Continuing with empty page counts");
                  setLoading(false);
                });
              } catch (setupErr) {
                console.error("TopUsers: Error setting up Firestore fetch:", setupErr);
                setErrorDetails(`Firestore setup error: ${setupErr.message}`);
                setError(setupErr);
                setLoading(false);
              }
            } else {
              console.log('TopUsers: No user data found');
              setAllTimeUsers([]);
              setLoading(false);
            }
          }, (err) => {
            console.error("TopUsers: Error listening for RTDB changes:", err);
            setErrorDetails(`RTDB error: ${err.message}`);
            setError(err);
            setLoading(false);
          });
        } catch (rtdbErr) {
          console.error("TopUsers: Error setting up RTDB listener:", rtdbErr);
          setErrorDetails(`RTDB error: ${rtdbErr.message}`);
          setError(rtdbErr);
          setLoading(false);
        }
      } catch (err) {
        console.error("TopUsers: General error in fetchUsersAndPages:", err);
        setErrorDetails(`General error: ${err.message}`);
        setError(err);
        setLoading(false);
      }
    };

    fetchUsersAndPages();
  }, [user]);

  return (
    <div className="space-y-4">
      {/* All-time leaderboard */}
      <div className="space-y-4">
        {/* Header is now provided by SectionTitle in the parent component */}

        <div className="border border-theme-medium rounded-lg overflow-hidden">
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
            <Table className="table-compact">
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead className="text-right cursor-pointer" onClick={toggleSortDirection}>
                    <div className="flex items-center justify-end gap-1">
                      Pages
                      {sortDirection === "desc" ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-accent/5 transition-colors"
                    onClick={() => window.location.href = `/user/${user.id}`}
                  >
                    <TableCell>
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
                    <TableCell className="text-right font-medium">{user.pageCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopUsers;