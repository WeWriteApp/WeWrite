"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../components/ui/button';
import { ChevronLeft, Trophy, Loader, ChevronUp, ChevronDown, Info, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { PillLink } from '../components/PillLink';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { SupporterIcon } from "../components/SupporterIcon";
import { collection, getDocs, query, orderBy, limit as firestoreLimit, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase/database";

interface User {
  id: string;
  username: string;
  photoURL?: string;
  pageCount: number;
  tier?: string | null;
  subscriptionStatus?: string | null;
}

export default function UsersPageClient() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState("");
  const [sortDirection, setSortDirection] = useState("desc"); // "desc" or "asc"
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);

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
        const featureFlagsRef = doc(db, 'config', 'featureFlags');
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

  // Fetch users data
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        setErrorDetails("");

        // Get all users from Firestore
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, orderBy('pageCount', 'desc'), firestoreLimit(50));
        const usersSnapshot = await getDocs(usersQuery);

        if (usersSnapshot.empty) {
          setUsers([]);
          setLoading(false);
          return;
        }

        // Process users data
        const usersData: User[] = [];
        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data();
          
          // Fetch subscription information if available
          let tier = null;
          let subscriptionStatus = null;
          try {
            const subscriptionDoc = await getDoc(doc(db, 'subscriptions', userDoc.id));
            if (subscriptionDoc.exists()) {
              const subscriptionData = subscriptionDoc.data();
              tier = subscriptionData.tier;
              subscriptionStatus = subscriptionData.status;
            }
          } catch (err) {
            console.error(`Error fetching subscription for user ${userDoc.id}:`, err);
          }

          usersData.push({
            id: userDoc.id,
            username: userData.username || "Missing username",
            photoURL: userData.photoURL,
            pageCount: userData.pageCount || 0,
            tier,
            subscriptionStatus
          });
        }

        setUsers(usersData);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
        setErrorDetails(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
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
                          <p>View profile</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {user.pageCount}
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
