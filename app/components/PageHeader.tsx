"use client";

import * as React from "react";
import { ChevronLeftIcon, DotsVerticalIcon, Share2Icon } from "@radix-ui/react-icons";
import Link from "next/link";

export interface PageHeaderProps {
  title: string;
  username: string;
  userGroups?: { id: string; name: string }[];
  currentGroupId?: string | null;
  onGroupChange?: (groupId: string | null) => void;
  isPublic?: boolean;
  onPrivacyChange?: (isPublic: boolean) => void;
  onBack?: () => void;
}

export function PageHeader({ 
  title,
  username,
  userGroups = [],
  currentGroupId,
  onGroupChange,
  isPublic = false,
  onPrivacyChange,
  onBack
}: PageHeaderProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [showBylineMenu, setShowBylineMenu] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const viewportHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;
      
      // Calculate scroll percentage
      const scrollPercentage = (scrolled / (fullHeight - viewportHeight)) * 100;
      setScrollProgress(Math.min(scrollPercentage, 100));
      
      // Update header collapse state
      setIsCollapsed(scrolled > 64);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
      {/* Progress bar */}
      <div 
        className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300"
        style={{ width: `${scrollProgress}%` }}
      />

      <div className="container mx-auto px-4">
        <div className={`flex items-center gap-4 transition-all duration-300 ${isCollapsed ? "h-16" : "h-20"}`}>
          {/* Back button */}
          <button
            onClick={onBack}
            className="rounded-full p-2 hover:bg-accent"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          {/* Title and byline */}
          <div className="flex-1">
            <h1 className={`font-semibold transition-all duration-300 ${isCollapsed ? "text-base" : "text-xl"}`}>
              {title}
            </h1>
            <button
              onClick={() => setShowBylineMenu(true)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {currentGroupId 
                ? `in ${userGroups.find(g => g.id === currentGroupId)?.name}`
                : `by ${username}`
              }
            </button>

            {/* Byline menu */}
            {showBylineMenu && (
              <div className="absolute mt-2 p-4 bg-background border rounded-lg shadow-lg">
                <div className="space-y-2">
                  <label className="block font-medium">Myself:</label>
                  <button
                    onClick={() => {
                      onGroupChange?.(null);
                      setShowBylineMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md ${!currentGroupId ? 'bg-accent' : ''}`}
                  >
                    by {username}
                  </button>

                  {userGroups.length > 0 && (
                    <>
                      <label className="block font-medium mt-4">My groups:</label>
                      <div className="space-y-1">
                        {userGroups.map((group) => (
                          <button
                            key={group.id}
                            onClick={() => {
                              onGroupChange?.(group.id);
                              setShowBylineMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-md ${
                              currentGroupId === group.id ? 'bg-accent' : ''
                            }`}
                          >
                            in {group.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="rounded-full p-2 hover:bg-accent">
              <Share2Icon className="h-4 w-4" />
            </button>
            <button className="rounded-full p-2 hover:bg-accent">
              <DotsVerticalIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
} 