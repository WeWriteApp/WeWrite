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
import { sanitizeUsername } from '../../utils/usernameSecurity';
import { trackInteractionEvent } from '../../utils/analytics-service';
import { SHARE_EVENTS, EVENT_CATEGORIES } from '../../constants/analytics-events';

const SingleProfileView = ({ profile }) => {
  const { user } = useAuth();
  const router = useRouter();

  // Early return if profile is not available
  if (!profile) {
    return null;
  }

  // Check if this profile belongs to the current user
  const isCurrentUser = user && user.uid === profile.uid;

  // Share profile function - shares URL only for easy pasting
  const handleShareProfile = () => {
    const profileUrl = window.location.href;

    // Track share started
    trackInteractionEvent(SHARE_EVENTS.PROFILE_SHARE_STARTED, EVENT_CATEGORIES.SHARE, {
      profile_id: profile.uid,
      profile_username: profile.username,
      is_own_profile: isCurrentUser
    });

    // Check if the Web Share API is available
    if (navigator.share) {
      // Share URL only - no extra text, so it can be easily pasted into a URL bar
      navigator.share({
        url: profileUrl
      }).then(() => {
        // Track successful share
        trackInteractionEvent(SHARE_EVENTS.PROFILE_SHARE_SUCCEEDED, EVENT_CATEGORIES.SHARE, {
          profile_id: profile.uid,
          profile_username: profile.username,
          share_method: 'native_share',
          is_own_profile: isCurrentUser
        });
      }).catch((error) => {
        // Track cancelled or failed share
        if (error.name === 'AbortError') {
          trackInteractionEvent(SHARE_EVENTS.PROFILE_SHARE_CANCELLED, EVENT_CATEGORIES.SHARE, {
            profile_id: profile.uid,
            profile_username: profile.username,
            share_method: 'native_share',
            is_own_profile: isCurrentUser
          });
        } else {
          trackInteractionEvent(SHARE_EVENTS.PROFILE_SHARE_FAILED, EVENT_CATEGORIES.SHARE, {
            profile_id: profile.uid,
            profile_username: profile.username,
            share_method: 'native_share',
            error_message: error.message,
            is_own_profile: isCurrentUser
          });
        }
        console.error('Error sharing:', error);
      });
    } else {
      // Fallback: copy the URL to clipboard
      try {
        navigator.clipboard.writeText(profileUrl);
        // Track successful clipboard copy
        trackInteractionEvent(SHARE_EVENTS.PROFILE_SHARE_SUCCEEDED, EVENT_CATEGORIES.SHARE, {
          profile_id: profile.uid,
          profile_username: profile.username,
          share_method: 'copy_link',
          is_own_profile: isCurrentUser
        });
      } catch (clipboardError) {
        trackInteractionEvent(SHARE_EVENTS.PROFILE_SHARE_FAILED, EVENT_CATEGORIES.SHARE, {
          profile_id: profile.uid,
          profile_username: profile.username,
          share_method: 'copy_link',
          error_message: clipboardError.message,
          is_own_profile: isCurrentUser
        });
        console.error('Error copying link:', clipboardError);
      }
    }
  };

  // UsernameBadge handles all data fetching automatically

  return (
    <ProfilePagesProvider userId={profile.uid}>
      {/* Content area - header spacing handled by NavPageLayout */}
      <div className="space-y-6">
        {/* Profile header - separate card */}
        <div className="wewrite-card">
          {/* Username row */}
          <div className="flex flex-col items-center">
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


        </div>





        {/* Profile tabs and content - outside of card */}
        <UserProfileTabs profile={profile} />
      </div>

      {/* Floating allocation bar - only show on other people's pages */}
      {!isCurrentUser && (
        <AllocationBar
          pageId={profile.uid}
          pageTitle={`@${profile.username || 'User'}`}
          authorId={profile.uid}
          visible={true}
          variant="user"
          isUserAllocation={true}
          username={profile.username || 'User'}
        />
      )}
    </ProfilePagesProvider>
  );
};

export default SingleProfileView;
