"use client";
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { useAuth } from '../providers/AuthProvider';
import { firestore, rtdb } from "../firebase/config";
import { getCollectionName } from "../utils/environmentConfig";
import {
  Trophy,
  ArrowLeft,
  AlertTriangle,
  Info,
  ChevronUp,
  ChevronDown,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "../components/ui/tooltip";
import { PillLink } from "../components/utils/PillLink";

// Type definitions
interface User {
  id: string;
  username: string;
  photoURL?: string;
  pageCount: number;
}

interface UserData {
  username?: string;
  displayName?: string;
  photoURL?: string;
}

interface PageCountsByUser {
  [userId: string]: number;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<User[]>([]);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [error, setError] = useState<Error | null>(null);
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const usersPerPage = 100;
  const hasMore = displayedUsers.length < allUsers.length;

  const toggleSortDirection = (): void => {
    setSortDirection(sortDirection === "desc" ? "asc" : "desc");
  };

  // Apply sorting to displayed users
  const sortedUsers = [...displayedUsers].sort((a, b) => {
    if (sortDirection === "desc") {
      return b.pageCount - a.pageCount;
    } else {
      return a.pageCount - b.pageCount;
    }
  });

  const loadMore = (): void => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    // Calculate start and end indices
    const start = page * usersPerPage;
    const end = start + usersPerPage;

    // Get next batch of users
    const nextBatch = allUsers.slice(start, end);

    // Update displayed users
    setDisplayedUsers(prev => [...prev, ...nextBatch]);
    setPage(prev => prev + 1);
    setLoadingMore(false);
  };

  useEffect(() => {
    const fetchUsersAndPages = async (): Promise<void> => {
      try {
        // First, let's check if user auth state is available
        console.log("Leaderboard: Current auth user state:", user ? `Logged in as ${user.email}` : "Not logged in");

        // Try to fetch users from RTDB
        console.log("Leaderboard: Attempting to fetch users from RTDB");
        const usersRef = ref(rtdb, 'users');

        try {
          console.log("Leaderboard: Getting snapshot from users ref");
          onValue(usersRef, (snapshot) => {
            console.log("Leaderboard: Got snapshot, exists:", snapshot.exists());

            if (!snapshot.exists()) {
              console.log("Leaderboard: No user data found in snapshot");
              setAllUsers([]);
              setDisplayedUsers([]);
              setLoading(false);
              return;
            }

            const data = snapshot.val() as Record<string, UserData>;
            console.log(`Leaderboard: Retrieved data for ${Object.keys(data).length} users`);

            if (data) {
              // Create a lookup object to store page counts per user
              const pageCountsByUser: PageCountsByUser = {};

              // Now get pages from Firestore
              try {
                console.log("Leaderboard: Attempting to fetch pages from Firestore");

                // Use an async IIFE to be able to use await inside the onValue callback
                (async () => {
                  try {
                    const pagesRef = collection(firestore, getCollectionName('pages'));
                    // No limit here as we want to get all pages for accurate counts
                    const pagesSnapshot = await getDocs(pagesRef);

                    console.log(`Leaderboard: Retrieved ${pagesSnapshot.size} pages from Firestore`);

                    // Count pages by user
                    pagesSnapshot.forEach((doc) => {
                      const pageData = doc.data();
                      const userId = pageData.userId;

                      if (userId) {
                        // Increment page count for this user
                        pageCountsByUser[userId] = (pageCountsByUser[userId] || 0) + 1;
                      }
                    });

                    console.log("Leaderboard: Processing user data");

                    // Process users with their page counts
                    const usersArray: User[] = Object.entries(data).map(([id, userData]) => ({
                      id,
                      username: userData.username || userData.displayName || "Unknown User",
                      photoURL: userData.photoURL,
                      pageCount: pageCountsByUser[id] || 0
                    }));

                    // Sort users by page count (including users with 0 pages)
                    const sortedUsers = usersArray
                      .sort((a, b) => b.pageCount - a.pageCount);

                    console.log(`Leaderboard: Found ${sortedUsers.length} users`);

                    setAllUsers(sortedUsers);
                    setDisplayedUsers(sortedUsers.slice(0, usersPerPage));
                    setLoading(false);
                    setError(null);
                  } catch (innerErr: any) {
                    console.error("Leaderboard: Inner error fetching Firestore pages:", innerErr);
                    setErrorDetails(`Firestore inner error: ${innerErr.message}`);
                    setError(innerErr);
                    setLoading(false);
                  }
                })().catch((firestoreErr: any) => {
                  console.error("Leaderboard: Error fetching Firestore pages:", firestoreErr);
                  setErrorDetails(`Firestore error: ${firestoreErr.message}`);
                  setError(firestoreErr);
                  setLoading(false);
                });
              } catch (firestoreErr: any) {
                console.error("Leaderboard: Error fetching Firestore pages:", firestoreErr);
                setErrorDetails(`Firestore error: ${firestoreErr.message}`);
                setError(firestoreErr);
                setLoading(false);
              }
            } else {
              console.log('Leaderboard: No user data found');
              setAllUsers([]);
              setDisplayedUsers([]);
              setLoading(false);
            }
          });
        } catch (rtdbErr: any) {
          console.error("Leaderboard: Error getting RTDB snapshot:", rtdbErr);
          setErrorDetails(`RTDB error: ${rtdbErr.message}`);
          setError(rtdbErr);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Leaderboard: General error in fetchUsersAndPages:", err);
        setErrorDetails(`General error: ${err.message}`);
        setError(err);
        setLoading(false);
      }
    };

    fetchUsersAndPages();
  }, [user]);

  return (
    <main className="p-4 md:p-6 space-y-6 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to home</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Top Users</h1>
        </div>
      </div>

      <div className="border-theme-medium rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center p-8 min-h-[300px]">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading users...</span>
            </div>
          </div>
        ) : error && !user ? (
          <div className="flex items-center gap-2 p-4 text-sm bg-muted/50 text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0" />
            <p>Sign in to see the leaderboard</p>
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
            <div className="flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">There was a problem loading the leaderboard</p>
                {errorDetails && <p className="mt-1 text-xs opacity-80">{errorDetails}</p>}
              </div>
            </div>
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            <p>No users found</p>
          </div>
        ) : (
          <>
            <Table className="table-compact">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 px-2">Rank</TableHead>
                  <TableHead className="px-2">Username</TableHead>
                  <TableHead
                    className="w-16 px-2 text-right cursor-pointer"
                    onClick={toggleSortDirection}
                  >
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
                {sortedUsers.map((user, index) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-muted-foreground px-2 w-12">
                      {sortDirection === "desc"
                        ? index + 1
                        : displayedUsers.length - index}
                    </TableCell>
                    <TableCell className="px-2">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <PillLink
                              href={`/user/${user.id}`}
                              className="max-w-[180px] truncate"
                            >
                              {user.username}
                            </PillLink>
                          </TooltipTrigger>
                          <TooltipContent>
                            <span>View user's pages</span>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right font-medium px-2 w-16">{user.pageCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {hasMore && (
              <div className="p-4 flex justify-center">
                <Button
                  onClick={loadMore}
                  variant="outline"
                  disabled={loadingMore}
                  className="min-w-[200px]"
                >
                  {loadingMore ? (
                    <>
                      <div className="loader mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    `Load ${Math.min(usersPerPage, allUsers.length - displayedUsers.length)} More`
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}