"use client";

import * as React from "react";
import { useState, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Bell,
  User,
  Settings,
  Palette,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { MobileContext } from "../providers/MobileProvider";
import { AuthContext } from "../providers/AuthProvider";
import { getRandomPage } from "../utils/randomPage";
import AppearanceModal from "./AppearanceModal";
import NotificationBadge from "./NotificationBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export default function Navigation() {
  const mobileContext = useContext(MobileContext);
  const { isMobile } = mobileContext || { isMobile: false };
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname() || '';

  // Force mobile view to always be true
  const alwaysShowMobileUI = true;

  const [expanded, setExpanded] = useState(true);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Function to navigate to a random page
  const navigateToRandomPage = async () => {
    try {
      setIsLoading(true);
      const randomPageId = await getRandomPage();
      if (randomPageId) {
        router.push(`/${randomPageId}`);
      } else {
        console.error("No random page found");
      }
    } catch (error) {
      console.error("Error navigating to random page:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation items
  const navItems = [
    {
      name: "Notifications",
      icon: <Bell className="h-7 w-7" />,
      onClick: () => router.push("/notifications"),
      badge: <NotificationBadge className="absolute -top-1 -right-1" />
    },
    {
      name: "Profile",
      icon: <User className="h-7 w-7" />,
      onClick: () => user && router.push(`/user/${user.uid}`)
    },
    {
      name: "Settings",
      icon: <Settings className="h-7 w-7" />,
      onClick: () => router.push("/account")
    },
    {
      name: "Appearance",
      icon: <Palette className="h-7 w-7" />,
      onClick: () => setShowAppearanceModal(true)
    },
    {
      name: "Random Page",
      icon: <Shuffle className={cn("h-7 w-7", isLoading && "animate-spin")} />,
      onClick: navigateToRandomPage
    }
  ];

  // Mobile Bottom Toolbar
  // Debug log for mobile status
  console.log("Navigation component mobile status:", { isMobile, alwaysShowMobileUI });

  return (
    <>
      {/* Appearance Modal */}
      <AppearanceModal
        isOpen={showAppearanceModal}
        onClose={() => setShowAppearanceModal(false)}
      />
    </>
  );
}
