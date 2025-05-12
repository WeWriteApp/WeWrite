"use client";
import React from "react";
import UserProfileTabs from "./UserProfileTabs";

// This is a wrapper component that ensures the Pages tab is the default
export default function UserProfileTabsWrapper({ profile }) {
  return <UserProfileTabs profile={profile} defaultTab="pages" />;
}
