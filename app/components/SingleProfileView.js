"use client";
import React, { useContext, useState, useEffect } from "react";
import UserActivitySparkline from "./UserActivitySparkline";
import { PillLink } from "./PillLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataContext } from "../providers/DataProvider";
import TypeaheadSearch from "./TypeaheadSearch";
import {
  ProfilePagesProvider,
  ProfilePagesContext,
} from "../providers/ProfilePageProvider";
import { useAuth } from "../providers/AuthProvider";
import { Loader, Settings, ChevronLeft, Heart, DollarSign } from "lucide-react";
import { Button } from "./ui/button";
import UserProfileTabs from "./UserProfileTabs";
import { getUserFollowerCount } from "../firebase/follows";
import PledgeBarModal from "./PledgeBarModal";

const SingleProfileView = ({ profile }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [pageCount, setPageCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [donorCount, setDonorCount] = useState(0); // Added donor count
  const [username, setUsername] = useState(profile.username || 'Anonymous');
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showDonorModal, setShowDonorModal] = useState(false);

  // Check if this profile belongs to the current user
  const isCurrentUser = user && user.uid === profile.uid;

  // Fetch username if not provided
  useEffect(() => {
    const fetchUsername = async () => {
      if (profile.uid && (!profile.username || profile.username === 'Anonymous')) {
        try {
          const { getUsernameById } = await import('../utils/userUtils');
          const fetchedUsername = await getUsernameById(profile.uid);
          if (fetchedUsername && fetchedUsername !== 'Anonymous') {
            setUsername(fetchedUsername);
            console.log(`Fetched username for profile: ${fetchedUsername}`);
          }
        } catch (error) {
          console.error('Error fetching username for profile:', error);
        }
      }
    };

    fetchUsername();
  }, [profile.uid, profile.username]);

  // Fetch follower count and page count with optimized loading
  useEffect(() => {
    const fetchStats = async () => {
      if (profile.uid) {
        try {
          setIsLoadingStats(true);

          // Use Promise.all to fetch both stats in parallel
          const [followerCountPromise, pageCountPromise] = await Promise.all([
            // Get follower count
            getUserFollowerCount(profile.uid),

            // Get page count from Firestore
            (async () => {
              const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
              const { db } = await import('../firebase/database');

              // Use a more efficient query with limit
              const pagesQuery = query(
                collection(db, 'pages'),
                where('userId', '==', profile.uid),
                limit(100) // Limit to 100 pages for performance
              );

              const pagesSnapshot = await getDocs(pagesQuery);
              return pagesSnapshot.size;
            })()
          ]);

          // Update state with results
          setFollowerCount(followerCountPromise);
          setPageCount(pageCountPromise);

        } catch (error) {
          console.error('Error fetching user stats:', error);
        } finally {
          setIsLoadingStats(false);
        }
      }
    };

    fetchStats();
  }, [profile.uid]);

  return (
    <ProfilePagesProvider userId={profile.uid}>
      <div className="p-2">
        <div className="flex items-center mb-4">
          <div className="flex-1">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Centered title */}
          <div className="flex items-center justify-center">
            <h1 className="text-3xl font-semibold">{username}</h1>
          </div>

          {/* Settings button - only visible for current user */}
          <div className="flex-1 flex justify-end">
            {isCurrentUser && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full hover:bg-[rgba(255,255,255,0.1)]"
                onClick={() => router.push('/account')}
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}
            {!isCurrentUser && <div className="w-8" />}
          </div>
        </div>

        {/* User stats */}
        <div className="flex flex-wrap gap-4 items-center justify-center mb-4">
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold">
              {isLoadingStats ? (
                <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
              ) : (
                pageCount
              )}
            </span>
            <span className="text-xs text-muted-foreground">pages</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold">
              {isLoadingStats ? (
                <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
              ) : (
                followerCount
              )}
            </span>
            <span className="text-xs text-muted-foreground">followers</span>
          </div>

          <div
            className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setShowDonorModal(true)}
            title="View donors"
          >
            <span className="text-lg font-semibold">
              {isLoadingStats ? (
                <div className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
              ) : (
                donorCount
              )}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              donors
            </span>
          </div>
        </div>

        {!user && (
          <div className="bg-primary/10 text-primary border border-primary/20 rounded-md p-4 mb-4">
            <p>
              You are viewing this profile as a guest.
              <Link href="/auth/login" className="ml-2 font-medium underline">
                Log in
              </Link>
              to interact with {profile.username}'s pages.
            </p>
          </div>
        )}

        <div className="my-4">
          <TypeaheadSearch
            userId={profile.uid}
            placeholder={`Search ${username}'s pages...`}
          />
        </div>
        <UserProfileTabs profile={profile} />

        {/* Donors Modal */}
        <PledgeBarModal
          isOpen={showDonorModal}
          onClose={() => setShowDonorModal(false)}
          isSignedIn={!!user}
          customContent={{
            title: "Ability to donate coming soon!",
            description: "Soon you'll be able to support this creator directly through WeWrite. We're still building this functionality, and if you'd like to help us get there sooner, you can support us!",
            action: {
              href: "https://opencollective.com/wewrite-app",
              label: "Support WeWrite",
              external: true
            }
          }}
        />
      </div>
    </ProfilePagesProvider>
  );
};

export default SingleProfileView;
