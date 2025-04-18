"use client";
import React, { useContext, useState, useEffect } from "react";
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
import { Loader, Settings, ChevronLeft, Heart } from "lucide-react";
import { Button } from "./ui/button";
import UserProfileTabs from "./UserProfileTabs";
import { getUserFollowerCount } from "../firebase/follows";

const SingleProfileView = ({ profile }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [pageCount, setPageCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [username, setUsername] = useState(profile.username || 'Anonymous');
  const [isLoadingStats, setIsLoadingStats] = useState(true);

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

  // Fetch follower count and page count
  useEffect(() => {
    const fetchStats = async () => {
      if (profile.uid) {
        try {
          setIsLoadingStats(true);

          // Get follower count
          const count = await getUserFollowerCount(profile.uid);
          setFollowerCount(count);

          // Get page count from Firestore
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const { db } = await import('../firebase/database');

          const pagesQuery = query(
            collection(db, 'pages'),
            where('userId', '==', profile.uid)
          );

          const pagesSnapshot = await getDocs(pagesQuery);
          setPageCount(pagesSnapshot.size);

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
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                pageCount
              )}
            </span>
            <span className="text-xs text-muted-foreground">pages</span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold">
              {isLoadingStats ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                followerCount
              )}
            </span>
            <span className="text-xs text-muted-foreground">followers</span>
          </div>
        </div>

        {!user && (
          <div className="bg-primary/10 text-primary border border-primary/20 rounded-md p-4 mb-4">
            <div className="flex flex-col space-y-3">
              <p className="text-center">
                You are viewing this profile as a guest.
              </p>
              <div className="flex justify-center space-x-3">
                <Link href="/auth/register">
                  <Button variant="outline" size="sm">
                    Create Account
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="default" size="sm" className="text-white">
                    Log In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="my-4">
          <TypeaheadSearch
            userId={profile.uid}
            placeholder={`Search ${username}'s pages...`}
          />
        </div>
        <UserProfileTabs profile={profile} />
      </div>
    </ProfilePagesProvider>
  );
};

export default SingleProfileView;
