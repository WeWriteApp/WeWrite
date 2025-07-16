"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/button';
import { ChevronLeft, Trophy, Loader, ChevronUp, ChevronDown, Info, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { PillLink } from '../components/utils/PillLink';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { SupporterIcon } from "../components/payments/SupporterIcon";
import { SubscriptionTierBadge } from "../components/ui/SubscriptionTierBadge";
import { UsernameBadge } from "../components/ui/UsernameBadge";
import { collection, getDocs, query, orderBy, limit as firestoreLimit, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { getCollectionName } from "../utils/environmentConfig";
import SimpleSparkline from "../components/utils/SimpleSparkline";
import { getBatchUserActivityLast24Hours } from "../firebase/userActivity";

interface User {
  id: string;
  username: string;
  photoURL?: string;
  pageCount: number;
  tier?: string | null;
  subscriptionStatus?: string | null;
  subscriptionAmount?: number | null;
}

export default function UsersPageClient() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState("");
  const [sortDirection, setSortDirection] = useState("desc"); // "desc" or "asc"
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [userActivityData, setUserActivityData] = useState<Record<string, { total: number, hourly: number[] }>>({});

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === "desc" ? "asc" : "desc");
  };

  // Sort users by page count
  const sortedUsers = [...users].sort((a, b) => {
    if (sortDirection === "desc") {
      return b.pageCount - a.pageCount;
    } else {
      return a.pageCount - b.pageCount;
    }
  });

  // Check if subscription feature is enabled
  useEffect(() => {
    const checkSubscriptionFeature = async () => {
      try {
        const featureFlagsRef = doc(db, getCollectionName('config'), 'featureFlags');
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

  // Fetch users data
  useEffect(() => {
    const fetchUsersAndPages = async () => {
      try {
        console.log("UsersPage: Starting to fetch user and page data");
        setLoading(true);
        setError(null);
        setErrorDetails("");

        // Get all users from Firestore using environment-aware collection name
        const usersRef = collection(db, getCollectionName('users'));
        const usersSnapshot = await getDocs(usersRef);

        if (usersSnapshot.empty) {
          console.log("UsersPage: No users found");
          setUsers([]);
          setLoading(false);
          return;
        }

        console.log(`UsersPage: Retrieved ${usersSnapshot.size} users from Firestore`);

        // Create a lookup object to store page counts per user
        const pageCountsByUser = {};

        // Get pages from Firestore to count pages per user
        const pagesRef = collection(db, getCollectionName('pages'));
        const pagesSnapshot = await getDocs(pagesRef);

        console.log(`UsersPage: Retrieved ${pagesSnapshot.size} pages from Firestore`);

        // Count pages by user
        pagesSnapshot.forEach((doc) => {
          const pageData = doc.data();
          const userId = pageData.userId;

          if (userId) {
            // Increment page count for this user
            pageCountsByUser[userId] = (pageCountsByUser[userId] || 0) + 1;
          }
        });

        console.log("UsersPage: Processing user data");

        // Process users data
        const usersData: User[] = [];

        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data();
          const userId = userDoc.id;

          // Get the username and remove @ symbol if present
          let username = userData.username || "Unknown User";
          if (username.startsWith('@')) {
            username = username.substring(1);
          }

          // Fetch subscription information if available
          let tier = null;
          let subscriptionStatus = null;
          let subscriptionAmount = null;
          try {
            // Use API endpoint to fetch subscription data server-side
            const subscriptionResponse = await fetch(`/api/account-subscription?userId=${userId}`);
            if (subscriptionResponse.ok) {
              const subscriptionData = await subscriptionResponse.json();
              tier = subscriptionData.tier;
              subscriptionStatus = subscriptionData.status;
              subscriptionAmount = subscriptionData.amount;
            }
          } catch (err) {
            console.error(`Error fetching subscription for user ${userId}:`, err);
          }

          usersData.push({
            id: userId,
            username,
            photoURL: userData.photoURL,
            pageCount: pageCountsByUser[userId] || 0,
            tier,
            subscriptionStatus,
            subscriptionAmount
          });
        }

        // Sort users by page count
        const sortedUsersData = usersData.sort((a, b) => b.pageCount - a.pageCount);

        console.log(`UsersPage: Processed ${sortedUsersData.length} users with page counts`);

        // Fetch activity data for all users
        try {
          const userIds = sortedUsersData.map(user => user.id);
          console.log('UsersPage: Fetching activity data for users:', userIds);
          const activityData = await getBatchUserActivityLast24Hours(userIds);
          console.log('UsersPage: Received activity data:', activityData);
          setUserActivityData(activityData);
        } catch (activityError) {
          console.error('UsersPage: Error fetching user activity data:', activityError);
          // Continue with empty activity data rather than failing
          setUserActivityData({});
        }

        setUsers(sortedUsersData);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
        setErrorDetails(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsersAndPages();
  }, []);

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            try {
              // Use router.back() with a fallback to home page
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push('/');
              }
            } catch (error) {
              console.error("Navigation error:", error);
              // Fallback to home page if there's any error
              router.push('/');
            }
          }}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-2xl font-bold flex items-center absolute left-1/2 transform -translate-x-1/2">
          <Trophy className="mr-2 h-5 w-5" />
          Top Users
        </h1>

        {/* Empty div to balance layout */}
        <div className="w-[73px]" />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Loader className="h-8 w-8 animate-pulse text-primary mb-4" />
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">There was a problem loading the users</p>
              {errorDetails && <p className="mt-1 text-xs opacity-80">{errorDetails}</p>}
            </div>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground text-center">
          <p>No users found</p>
        </div>
      ) : (
        <div className="border border-theme-medium rounded-lg overflow-hidden shadow-md dark:bg-card/90 dark:hover:bg-card/100 w-full">
          <Table>
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
                <TableHead>Activity (24h)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map((session) => (
                <TableRow
                  key={user.id}
                  className="cursor-pointer hover:bg-accent/5 transition-colors"
                  onClick={() => window.location.href = `/user/${user.id}`}
                >
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <UsernameBadge
                            userId={user.id}
                            username={user.username || "Unknown User"}
                            tier={user.tier}
                            subscriptionStatus={user.subscriptionStatus}
                            subscriptionAmount={user.subscriptionAmount}
                            size="sm"
                            variant="pill"
                            pillVariant="primary"
                            onClick={(e) => e.stopPropagation()} // Prevent double navigation
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View profile</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {user.pageCount}
                  </TableCell>
                  <TableCell>
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
        </div>
      )}
    </div>
  );
}