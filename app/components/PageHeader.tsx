"use client";

import * as React from "react";
import { ChevronLeft, ChevronDown, Lock, Unlock, Moon, Sun, Link as LinkIcon } from 'lucide-react';
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useClickOutside } from "../hooks/useClickOutside";
import { updatePage } from "../firebase/database";
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from 'next-themes';

export interface PageHeaderProps {
  title: string;
  username: string;
  userGroups?: { id: string; name: string }[];
  currentGroupId?: string | null;
  onGroupChange?: (groupId: string | null) => void;
  isPublic?: boolean;
  onPrivacyChange?: (isPublic: boolean) => void;
  pageId?: string;
  showBackButton?: boolean;
}

export default function PageHeader({ 
  title,
  username,
  userGroups = [],
  currentGroupId,
  onGroupChange,
  isPublic = false,
  onPrivacyChange,
  pageId,
  showBackButton = false
}: PageHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [showBylineMenu, setShowBylineMenu] = React.useState(false);
  const [showPrivacyMenu, setShowPrivacyMenu] = React.useState(false);
  const [currentPrivacy, setCurrentPrivacy] = React.useState(isPublic);
  const bylineRef = React.useRef<HTMLDivElement>(null);
  const privacyRef = React.useRef<HTMLDivElement>(null);

  useClickOutside(bylineRef, () => setShowBylineMenu(false));
  useClickOutside(privacyRef, () => setShowPrivacyMenu(false));

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

  const handlePrivacyChange = async (newIsPublic: boolean) => {
    if (pageId) {
      try {
        await updatePage(pageId, { isPublic: newIsPublic });
        setCurrentPrivacy(newIsPublic);
        onPrivacyChange?.(newIsPublic);
        toast.success(`Page is now ${newIsPublic ? 'public' : 'private'}`);
      } catch (error) {
        toast.error("Failed to update page privacy");
      }
    }
    setShowPrivacyMenu(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  const handleBack = () => {
    router.push('/');
  };

  const togglePrivacy = async () => {
    if (!pageId) return;
    const newPrivateState = !currentPrivacy;
    setCurrentPrivacy(newPrivateState);
    await updatePage(pageId, { isPublic: newPrivateState });
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        {/* Progress bar */}
        <div 
          className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300"
          style={{ width: `${scrollProgress}%` }}
        />

        <div className="flex items-center h-16 px-4">
          {/* Left section */}
          <div className="flex items-center gap-4">
            {showBackButton && (
              <button
                onClick={handleBack}
                className="rounded-full p-2 hover:bg-accent text-foreground"
                aria-label="Go back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div className="flex flex-col">
              <h1 className="font-semibold text-foreground text-base">
                {title}
              </h1>
              <div className="relative" ref={bylineRef}>
                <button
                  onClick={() => setShowBylineMenu(!showBylineMenu)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {currentGroupId 
                    ? `in ${userGroups.find(g => g.id === currentGroupId)?.name}`
                    : `by ${username}`
                  }
                </button>

                {/* Byline menu */}
                {showBylineMenu && (
                  <div className="absolute top-full left-0 mt-2 p-4 bg-background border rounded-lg shadow-lg min-w-[200px]">
                    <div className="space-y-2">
                      <label className="block font-medium text-foreground">Myself:</label>
                      <button
                        onClick={() => {
                          onGroupChange?.(null);
                          setShowBylineMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-foreground hover:bg-accent/50 ${!currentGroupId ? 'bg-accent' : ''}`}
                      >
                        by {username}
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
                                className={`w-full text-left px-3 py-2 rounded-md text-foreground hover:bg-accent/50 ${
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
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Privacy toggle */}
            <div className="relative" ref={privacyRef}>
              <button 
                className="rounded-full p-2 hover:bg-accent text-foreground group"
                onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
              >
                {currentPrivacy ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </button>

              {showPrivacyMenu && (
                <div className="absolute top-full right-0 mt-2 p-2 bg-background border rounded-lg shadow-lg min-w-[150px]">
                  <button
                    onClick={() => handlePrivacyChange(false)}
                    className={`w-full text-left px-3 py-2 rounded-md text-foreground hover:bg-accent/50 flex items-center gap-2 ${
                      !currentPrivacy ? 'bg-accent' : ''
                    }`}
                  >
                    <Lock className="h-4 w-4" />
                    Private
                  </button>
                  <button
                    onClick={() => handlePrivacyChange(true)}
                    className={`w-full text-left px-3 py-2 rounded-md text-foreground hover:bg-accent/50 flex items-center gap-2 ${
                      currentPrivacy ? 'bg-accent' : ''
                    }`}
                  >
                    <Unlock className="h-4 w-4" />
                    Public
                  </button>
                </div>
              )}
            </div>

            {/* Copy link button */}
            <button
              className="rounded-full p-2 hover:bg-accent text-foreground group relative"
              onClick={handleCopyLink}
              aria-label="Copy page link"
            >
              <LinkIcon className="h-4 w-4" />
              <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full px-2 py-1 bg-background border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                Copy page link
              </span>
            </button>

            {/* Theme toggle */}
            <button
              className="rounded-full p-2 hover:bg-accent text-foreground group"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>
      {/* Spacer to prevent content from being hidden under the header */}
      <div className="h-16" />
    </>
  );
} 