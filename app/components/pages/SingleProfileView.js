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

import UserProfileTabs from '../utils/UserProfileTabs';
import AllocationBar from '../payments/AllocationBar';

const SingleProfileView = ({ profile }) => {
  const { user } = useAuth();
  const router = useRouter();

  // Early return if profile is not available
  if (!profile) {
    return null;
  }

  // Check if this profile belongs to the current user
  const isCurrentUser = user && user.uid === profile.uid;

  // Share profile function
  const handleShareProfile = () => {
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
  };

  // UsernameBadge handles all data fetching automatically

  return (
    <ProfilePagesProvider userId={profile.uid}>
      {/* Content area - header spacing handled by NavPageLayout */}
      <div className="space-y-6">

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

          {/* Action buttons - responsive horizontal/vertical layout */}
          <div className="mb-3">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2">
              {/* Follow button - only show for other users */}
              {!isCurrentUser && (
                <UserFollowButton
                  userId={profile.uid}
                  username={profile.username}
                  size="md"
                  variant="outline"
                  className="w-full sm:w-auto min-w-[140px] h-10"
                />
              )}

              {/* Share button */}
              <Button
                variant="outline"
                size="md"
                onClick={handleShareProfile}
                className="flex items-center gap-2 w-full sm:w-auto min-w-[140px] h-10"
                title="Share profile"
              >
                <Share2 className="h-4 w-4" />
                <span>Share Profile</span>
              </Button>
            </div>
          </div>

          {/* UsernameBadge handles all subscription display automatically */}
        </div>





        <UserProfileTabs profile={profile} />
      </div>

      {/* Floating allocation bar - only show on other people's pages */}
      {!isCurrentUser && (
        <AllocationBar
          pageId={profile.uid}
          pageTitle={`@${profile.username || profile.displayName || 'User'}`}
          authorId={profile.uid}
          visible={true}
          variant="user"
          isUserAllocation={true}
          username={profile.username || profile.displayName || 'User'}
        />
      )}
    </ProfilePagesProvider>
  );
};

export default SingleProfileView;