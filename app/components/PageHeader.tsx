"use client";

import * as React from "react";
import { ChevronLeftIcon, Link1Icon } from "@radix-ui/react-icons";
import Link from "next/link";
import { toast } from "sonner";

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  return (
    <>
      {/* Spacer to prevent content from being hidden under the header */}
      <div className={`h-20 transition-all duration-300 ${isCollapsed ? "h-16" : "h-20"}`} />
      
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
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
              className="rounded-full p-2 hover:bg-accent text-foreground"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            {/* Title and byline */}
            <div className="flex-1">
              <h1 
                className={`font-semibold text-foreground transition-all duration-300 ${
                  isCollapsed 
                    ? "text-base transform translate-y-0" 
                    : "text-xl transform translate-y-2"
                }`}
              >
                {title}
              </h1>
              <div 
                className={`flex items-center gap-2 transition-all duration-300 ${
                  isCollapsed 
                    ? "opacity-100 transform translate-y-0" 
                    : "opacity-70 transform translate-y-1"
                }`}
              >
                <button
                  onClick={() => setShowBylineMenu(true)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {currentGroupId 
                    ? `in ${userGroups.find(g => g.id === currentGroupId)?.name}`
                    : `by ${username || 'Anonymous'}`
                  }
                </button>
              </div>

              {/* Byline menu */}
              {showBylineMenu && (
                <div className="absolute mt-2 p-4 bg-background border rounded-lg shadow-lg">
                  <div className="space-y-2">
                    <label className="block font-medium text-foreground">Myself:</label>
                    <button
                      onClick={() => {
                        onGroupChange?.(null);
                        setShowBylineMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-foreground ${!currentGroupId ? 'bg-accent' : ''}`}
                    >
                      by {username || 'Anonymous'}
                    </button>

                    {userGroups.length > 0 && (
                      <>
                        <label className="block font-medium text-foreground mt-4">My groups:</label>
                        <div className="space-y-1">
                          {userGroups.map((group) => (
                            <button
                              key={group.id}
                              onClick={() => {
                                onGroupChange?.(group.id);
                                setShowBylineMenu(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-md text-foreground ${
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
              <button 
                className="rounded-full p-2 hover:bg-accent text-foreground group relative"
                onClick={handleCopyLink}
              >
                <Link1Icon className="h-4 w-4" />
                <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-background border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  Copy page link
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>
    </>
  );
} 