"use client";
import React, { useContext, useState, useEffect } from "react";
import { PillLink } from "../utils/PillLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataContext } from "../../providers/DataProvider";

import {
  ProfilePagesProvider,
  ProfilePagesContext} from "../../providers/ProfilePageProvider";
import { useAuth } from '../../providers/AuthProvider';
import { Share2 } from "lucide-react";
import { UsernameBadge } from "../ui/UsernameBadge";
import { Button } from "../ui/button";
import { UserFollowButton } from "../utils/UserFollowButton";
import NavHeader from "../layout/NavHeader";

import UserProfileTabs from '../utils/UserProfileTabs';
import PledgeBar from '../payments/PledgeBar';

const SingleProfileView = ({ profile }) => {
  const { user } = useAuth();
  const router = useRouter();

  // Check if this profile belongs to the current user
  const isCurrentUser = user && user.uid === profile.uid;

  // UsernameBadge handles all data fetching automatically

  return (
    <ProfilePagesProvider userId={profile.uid}>
      {/* Navigation Header */}
      <NavHeader
        backUrl="/"
        rightContent={
          <>
            {/* Desktop: Button with text and icon */}
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex gap-1"
              onClick={() => {
                // Create share text in the format: "[username]'s profile on @WeWriteApp [URL]"
                const profileUrl = window.location.href;
                const shareText = `${profile.username || 'User'}'s profile on @WeWriteApp ${profileUrl}`;

                // Check if the Web Share API is available
                if (navigator.share) {
                  navigator.share({
                    title: `${profile.username || 'User'} on WeWrite`,
                    text: shareText,
                    url: profileUrl
                  }).catch((error) => {
                    // Silent error handling - no toast
                    console.error('Error sharing:', error);
                  });
                } else {
                  // Create a Twitter share URL as fallback
                  try {
                    // First try to open Twitter share dialog
                    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
                    window.open(twitterShareUrl, '_blank', 'noopener,noreferrer');
                  } catch (error) {
                    console.error('Error opening Twitter share:', error);

                    // If that fails, copy the URL to clipboard
                    try {
                      navigator.clipboard.writeText(profileUrl);
                    } catch (clipboardError) {
                      console.error('Error copying link:', clipboardError);
                    }
                  }
                }
              }}
              title="Share"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </Button>

            {/* Mobile: Icon-only button */}
            <Button
              variant="outline"
              size="icon"
              className="sm:hidden"
              onClick={() => {
                // Create share text in the format: "[username]'s profile on @WeWriteApp [URL]"
                const profileUrl = window.location.href;
                const shareText = `${profile.username || 'User'}'s profile on @WeWriteApp ${profileUrl}`;

                // Check if the Web Share API is available
                if (navigator.share) {
                  navigator.share({
                    title: `${profile.username || 'User'} on WeWrite`,
                    text: shareText,
                    url: profileUrl
                  }).catch((error) => {
                    // Silent error handling - no toast
                    console.error('Error sharing:', error);
                  });
                } else {
                  // Create a Twitter share URL as fallback
                  try {
                    // First try to open Twitter share dialog
                    const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
                    window.open(twitterShareUrl, '_blank', 'noopener,noreferrer');
                  } catch (error) {
                    console.error('Error opening Twitter share:', error);

                    // If that fails, copy the URL to clipboard
                    try {
                      navigator.clipboard.writeText(profileUrl);
                    } catch (clipboardError) {
                      console.error('Error copying link:', clipboardError);
                    }
                  }
                }
              }}
              title="Share"
              aria-label="Share profile"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* Apply WeWrite standardized padding for consistent layout */}
      <div className="p-5 md:p-4">

        {/* Username row */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <UsernameBadge
              userId={profile.uid}
              username={profile.username}
              tier={profile.tier}
              subscriptionStatus={profile.subscriptionStatus}
              subscriptionAmount={profile.subscriptionAmount}
              size="lg"
              className="text-3xl font-semibold"
            />
          </div>

          {/* Follow button - only show for other users */}
          {!isCurrentUser && (
            <div className="mb-3">
              <UserFollowButton
                userId={profile.uid}
                username={profile.username}
                size="md"
                variant="outline"
              />
            </div>
          )}

          {/* UsernameBadge handles all subscription display automatically */}
        </div>





        <UserProfileTabs profile={profile} />

        {/* User Pledge Bar - floating and persistent across tabs - only show on other people's pages */}
        {!isCurrentUser && (
          <PledgeBar
            authorId={profile.uid}
            username={profile.username || profile.displayName || 'User'}
            visible={true}
            isUserAllocation={true}
          />
        )}
      </div>
    </ProfilePagesProvider>
  );
};

export default SingleProfileView;