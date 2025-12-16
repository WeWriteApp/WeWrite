"use client";
import React, { useContext, useState, useEffect } from "react";
import { PillLink } from "../utils/PillLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataContext } from "../../providers/DataProvider";
import { toast } from "../ui/use-toast";

import {
  ProfilePagesProvider,
  ProfilePagesContext} from "../../providers/ProfilePageProvider";
import { useAuth } from '../../providers/AuthProvider';
import { UsernameBadge } from "../ui/UsernameBadge";
import { UserFollowButton } from "../utils/UserFollowButton";

import UserProfileTabs from '../utils/UserProfileTabs';
import AllocationBar from '../payments/AllocationBar';
import { sanitizeUsername } from '../../utils/usernameSecurity';
import UserProfileHeader from './UserProfileHeader';

const SingleProfileView = ({ profile }) => {
  const { user } = useAuth();
  const router = useRouter();

  // Early return if profile is not available
  if (!profile) {
    return null;
  }

  // Check if this profile belongs to the current user
  const isCurrentUser = user && user.uid === profile.uid;

  // UsernameBadge handles all data fetching automatically

  return (
    <ProfilePagesProvider userId={profile.uid}>
      {/* Fixed header with back/logo/share */}
      <UserProfileHeader username={profile.username} />

      {/* Content area - add top padding for fixed header */}
      <div className="space-y-6 pt-14">
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
              size="md"
              className="text-lg font-semibold"
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
