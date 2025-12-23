"use client";
import React from "react";
import { useRouter } from "next/navigation";

import { ProfilePagesProvider } from "../../providers/ProfilePageProvider";
import { useAuth } from '../../providers/AuthProvider';
import { UsernameBadge } from "../ui/UsernameBadge";
import { UserFollowButton } from "../utils/UserFollowButton";

import UserProfileTabs from '../utils/UserProfileTabs';
import AllocationBar from '../payments/AllocationBar';
import UserProfileHeader from './UserProfileHeader';
import UserProfileStats from '../utils/UserProfileStats';

interface Profile {
  uid: string;
  username?: string;
  tier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: number;
  createdAt?: string;
}

interface SingleProfileViewProps {
  profile: Profile | null;
}

const SingleProfileView: React.FC<SingleProfileViewProps> = ({ profile }) => {
  const { user } = useAuth();
  const router = useRouter();

  // Early return if profile is not available
  if (!profile) {
    return null;
  }

  // Check if this profile belongs to the current user
  const isCurrentUser = user && user.uid === profile.uid;

  return (
    <ProfilePagesProvider userId={profile.uid}>
      {/* Fixed header with back/logo/share */}
      <UserProfileHeader username={profile.username} />

      {/* Content area */}
      <div className="space-y-4">
        {/* Profile header - separate card */}
        <div className="wewrite-card pb-4">
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

          {/* Profile Stats with sparklines */}
          <UserProfileStats userId={profile.uid} createdAt={profile.createdAt} />
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
