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
import ThemeToggle from "./ThemeToggle";

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
  showBackButton = true
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
      <header className={`fixed top-0 left-0 right-0 z-50 bg-background border-b border-border transition-all duration-300 ${isCollapsed ? 'h-12' : 'h-16'}`}>
        {/* Progress bar */}
        <div 
          className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300"
          style={{ width: `${scrollProgress}%` }}
        />

        <div className={`flex items-center h-full px-4 transition-all duration-300`}>
          {/* Left section */}
          <div className="flex items-center gap-4 flex-1">
            {showBackButton && (
              <button
                onClick={handleBack}
                className={`rounded-full p-2 hover:bg-accent text-foreground hover:text-accent-foreground transition-all duration-300 ${isCollapsed ? 'scale-75' : ''}`}
                aria-label="Go back"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div className={`flex ${isCollapsed ? 'flex-row items-center gap-2' : 'flex-col'} transition-all duration-300`}>
              <h1 className={`font-semibold text-foreground transition-all duration-300 ${isCollapsed ? 'text-sm' : 'text-2xl'}`}>
                {title}
              </h1>
              <div className="relative">
                <span className={`text-muted-foreground transition-all duration-300 ${isCollapsed ? 'text-xs' : 'text-sm'}`}>
                  {currentGroupId 
                    ? `in ${userGroups.find(g => g.id === currentGroupId)?.name}`
                    : `by ${username}`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Right section */}
          <div className={`flex items-center gap-2 ml-auto transition-opacity duration-300 ${isCollapsed ? 'opacity-0 invisible' : 'opacity-100 visible'}`}>
            {/* Privacy toggle */}
            <div className="relative" ref={privacyRef}>
              <button 
                className="rounded-full p-2 hover:bg-accent text-foreground hover:text-accent-foreground transition-all duration-300"
                onClick={() => setShowPrivacyMenu(!showPrivacyMenu)}
              >
                {currentPrivacy ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </button>

              {showPrivacyMenu && (
                <div className="absolute top-full right-0 mt-2 p-2 bg-background/80 backdrop-blur-md border border-border rounded-lg shadow-lg min-w-[150px] z-50">
                  <button
                    onClick={() => handlePrivacyChange(false)}
                    className={`w-full text-left px-3 py-2 rounded-md text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${
                      !currentPrivacy ? 'bg-accent text-accent-foreground' : ''
                    }`}
                  >
                    <Lock className="h-4 w-4" />
                    Private
                  </button>
                  <button
                    onClick={() => handlePrivacyChange(true)}
                    className={`w-full text-left px-3 py-2 rounded-md text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${
                      currentPrivacy ? 'bg-accent text-accent-foreground' : ''
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
              className="rounded-full p-2 hover:bg-accent text-foreground hover:text-accent-foreground transition-all duration-300 relative"
              onClick={handleCopyLink}
              aria-label="Copy page link"
            >
              <LinkIcon className="h-4 w-4" />
              <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full px-2 py-1 bg-popover border border-border rounded text-xs text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                Copy page link
              </span>
            </button>

            {/* Theme toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {/* Spacer to prevent content from being hidden under the header */}
      <div className={`transition-all duration-300 ${isCollapsed ? 'h-12' : 'h-16'}`} />
    </>
  );
} 