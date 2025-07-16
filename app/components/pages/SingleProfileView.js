"use client";
import React, { useContext, useState, useEffect } from "react";
import { PillLink } from "../utils/PillLink";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataContext } from "../../providers/DataProvider";

import {
  ProfilePagesProvider,
  ProfilePagesContext} from "../../providers/ProfilePageProvider";
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { ChevronLeft, Share2 } from "lucide-react";
import { UsernameBadge } from "../ui/UsernameBadge";
import { Button } from "../ui/button";

import UserProfileTabs from '../utils/UserProfileTabs';

const SingleProfileView = ({ profile }) => {
  const { currentAccount } = useCurrentAccount();
  const router = useRouter();

  // Check if this profile belongs to the current user
  const isCurrentUser = currentAccount && currentAccount.uid === profile.uid;

  // UsernameBadge handles all data fetching automatically

  return (
    <ProfilePagesProvider userId={profile.uid}>
      {/* Apply WeWrite standardized padding for consistent layout */}
      <div className="p-5 md:p-4">
        {/* Navigation bar */}
        <div className="flex items-center mb-6">
          <div className="flex-1">
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
            </Link>
          </div>

          {/* Right side buttons */}
          <div className="flex-1 flex justify-end gap-2">
            {/* Share button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                // Create share text in the format: "[, sessionname]'s profile on @WeWriteApp [URL]"
                const profileUrl = window.location.href;
                const shareText = `${profile.username || 'User'}'s profile on @WeWriteApp ${profileUrl}`;

                // Check if the Web Share API is available
                if (navigator.share) {
                  navigator.share({
                    title: `${profile.username || 'User'} on WeWrite`,
                    text: shareText,
                    url: profileUrl}).catch((error) => {
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

            {/* Settings button removed for current user - now accessible via navigation menu */}
            {/* This eliminates UI redundancy as settings are available in the main navigation */}
          </div>
        </div>

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

          {/* UsernameBadge handles all subscription display automatically */}
        </div>





        <UserProfileTabs profile={profile} />
      </div>
    </ProfilePagesProvider>
  );
};

export default SingleProfileView;