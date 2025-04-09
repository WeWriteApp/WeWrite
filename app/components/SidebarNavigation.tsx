"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
  Shuffle,
  User,
  Palette,
  Home,
  Clock
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { useTheme } from "next-themes";
import { useAuth } from "../providers/AuthProvider";
import dynamic from 'next/dynamic';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'sonner';

// Dynamically import components to avoid hydration issues
const AccentColorSelector = dynamic(
  () => import('./AccentColorSelector'),
  { ssr: false }
);

const ReadingHistory = dynamic(
  () => import('./ReadingHistory'),
  { ssr: false }
);

// Define navigation levels
type NavLevel = "main" | "themes" | "history";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  hasSubmenu?: boolean;
}

function NavItem({ icon, label, onClick, hasSubmenu = false }: NavItemProps) {
  return (
    <Button
      variant="ghost"
      className="w-full justify-between text-sm px-3 py-2.5 h-auto"
      onClick={onClick}
    >
      <div className="flex items-center">
        <div className="mr-2">{icon}</div>
        <span>{label}</span>
      </div>
      {hasSubmenu && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
}

export function SidebarNavigation() {
  const [currentLevel, setCurrentLevel] = useState<NavLevel>("main");
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  // Function to handle navigation events
  const trackEvent = (eventName: string, eventData: any = {}) => {
    console.log(`Navigation event: ${eventName}`, eventData);
    // Here you would typically send this to your analytics service
    // Example: analytics.track(eventName, eventData);
  };

  // Handle new page creation
  const handleNewPage = () => {
    trackEvent("new_page_clicked");
    router.push("/new");
  };

  // Handle random page navigation
  const handleRandomPage = async () => {
    if (isRandomLoading) return; // Prevent multiple clicks

    setIsRandomLoading(true);

    // Track the event in our analytics
    trackEvent("random_page_clicked");

    // Also track in Google Analytics if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'random_page_clicked', {
        'event_category': 'navigation',
        'event_label': 'sidebar'
      });
    }

    try {
      // Add a cache-busting parameter to avoid caching issues
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/random-page?t=${timestamp}`, {
        // Add cache control headers
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch random page');
      }

      const data = await response.json();

      if (data.pageId) {
        // Navigate to the random page
        window.location.href = `/${data.pageId}`;
      } else {
        throw new Error('No page ID returned');
      }
    } catch (error) {
      console.error('Error fetching random page:', error);
      toast.error('Failed to find a random page');
      setIsRandomLoading(false);
    }
  };

  // Handle profile navigation
  const handleProfile = () => {
    if (!user) return;

    trackEvent("profile_clicked", { userId: user.uid });
    router.push(`/u/${user.uid}`);
  };

  // Theme options
  const themeOptions = [
    {
      value: "light",
      label: "Light",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-5 w-5 text-foreground"
        >
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2"></path>
          <path d="M12 20v2"></path>
          <path d="M4.93 4.93l1.41 1.41"></path>
          <path d="M17.66 17.66l1.41 1.41"></path>
          <path d="M2 12h2"></path>
          <path d="M20 12h2"></path>
          <path d="M6.34 17.66l-1.41 1.41"></path>
          <path d="M19.07 4.93l-1.41 1.41"></path>
        </svg>
      )
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-5 w-5 text-foreground"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
        </svg>
      )
    },
    {
      value: "system",
      label: "System",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-5 w-5 text-foreground"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      )
    }
  ];

  // Render the appropriate level with animation
  return (
    <div className="relative overflow-y-auto h-full" onScroll={(e) => e.stopPropagation()}>
      {/* Main Navigation */}
      <div
        className={`absolute inset-0 flex flex-col h-full transition-transform duration-300 ease-in-out ${currentLevel === "themes" ? "-translate-x-full" : "translate-x-0"}`}
      >
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Navigation</h3>

          <NavItem
            icon={<Home className="h-4 w-4" />}
            label="Home"
            onClick={() => {
              router.push("/");
              trackEvent("home_clicked");
              // Close the sidebar when clicking home
              if (typeof window !== 'undefined') {
                // Dispatch a custom event that Sidebar.tsx can listen for
                const event = new CustomEvent('closeSidebar');
                window.dispatchEvent(event);
              }
            }}
          />

          <NavItem
            icon={<FilePlus className="h-4 w-4" />}
            label="New Page"
            onClick={handleNewPage}
          />

          <NavItem
            icon={isRandomLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Shuffle className="h-4 w-4" />
            )}
            label={isRandomLoading ? "Loading..." : "Random Page"}
            onClick={handleRandomPage}
          />

          <NavItem
            icon={<User className="h-4 w-4" />}
            label="My Profile"
            onClick={handleProfile}
          />

          <NavItem
            icon={<Clock className="h-4 w-4" />}
            label="Reading History"
            hasSubmenu={true}
            onClick={() => {
              setCurrentLevel("history");
              trackEvent("history_submenu_opened");
            }}
          />
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Appearance</h3>
          <NavItem
            icon={<Palette className="h-4 w-4" />}
            label="Themes"
            hasSubmenu={true}
            onClick={() => {
              setCurrentLevel("themes");
              trackEvent("themes_submenu_opened");
            }}
          />
        </div>
      </div>

      {/* Themes Submenu */}
      <div
        className={`absolute inset-0 flex flex-col h-full overflow-y-auto transition-transform duration-300 ease-in-out ${currentLevel === "themes" ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setCurrentLevel("main");
              trackEvent("navigation_back_to_main");
            }}
            className="h-8 w-8 mr-2"
            aria-label="Back to main menu"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-lg font-medium">Theme Settings</h3>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Theme Mode</h3>
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setTheme(option.value);
                trackEvent("theme_changed", { theme: option.value });
              }}
              className={cn(
                "flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors mb-1",
                "hover:bg-accent hover:text-accent-foreground",
                theme === option.value && "bg-accent text-accent-foreground"
              )}
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-full border mr-2">
                {theme === option.value && (
                  <div className="w-3 h-3 rounded-full bg-primary" />
                )}
              </div>
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>

        <div className="mb-16">
          {/* Wrap AccentColorSelector in error boundary */}
          <React.Suspense fallback={<div className="p-3 text-sm text-muted-foreground">Loading color options...</div>}>
            <AccentColorSelector />
          </React.Suspense>
        </div>
      </div>

      {/* Reading History Submenu */}
      <div
        className={`absolute inset-0 flex flex-col h-full overflow-y-auto transition-transform duration-300 ease-in-out ${currentLevel === "history" ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setCurrentLevel("main");
              trackEvent("navigation_back_to_main");
            }}
            className="h-8 w-8 mr-2"
            aria-label="Back to main menu"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-lg font-medium">Reading History</h3>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ReadingHistory />
        </div>
      </div>
    </div>
  );
}
