"use client";

import * as React from "react";
import { Icon } from '@/components/ui/Icon';
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { Logo } from "../ui/Logo";
import { useSidebarContext } from "../layout/DesktopSidebar";
import { toast } from "../ui/use-toast";

export interface UserProfileHeaderProps {
  username?: string;
}

/**
 * UserProfileHeader Component
 *
 * Simple header for user profile pages with:
 * - Left: Back button
 * - Center: WeWrite logo
 * - Right: Share button
 *
 * Styled to match ContentPageHeader design.
 */
export default function UserProfileHeader({ username }: UserProfileHeaderProps) {
  const router = useRouter();
  const { sidebarWidth, isExpanded } = useSidebarContext();

  // Calculate header positioning width - matches ContentPageHeader
  const headerSidebarWidth = React.useMemo(() => {
    if (isExpanded) {
      return sidebarWidth;
    } else if (sidebarWidth > 0) {
      return 64;
    } else {
      return 0;
    }
  }, [isExpanded, sidebarWidth]);

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      router.back();
    } catch (error) {
      console.error("Navigation error:", error);
      window.history.back();
    }
  };

  const handleShareClick = () => {
    const profileUrl = window.location.href;

    if (navigator.share) {
      navigator.share({
        url: profileUrl
      }).catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      });
    } else {
      navigator.clipboard.writeText(profileUrl).then(() => {
        toast.success('Profile link copied to clipboard!');
      }).catch((clipboardError) => {
        console.error('Error copying link:', clipboardError);
      });
    }
  };

  return (
    <header
      className="wewrite-card wewrite-card-sharp wewrite-card-border-bottom wewrite-card-no-padding fixed top-0 left-0 right-0 w-full z-50"
      style={{
        top: 'var(--banner-stack-height, 0px)'
      }}
    >
      <div className="flex w-full h-full">
        {/* Sidebar spacer - only on desktop */}
        <div
          className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
          style={{ width: `${headerSidebarWidth}px` }}
        />

        {/* Header content area */}
        <div className="flex-1 min-w-0 relative px-4 header-padding-mobile">
          <div className="py-2">
            {/* Row: Back Button + Logo + Share Button */}
            <div className="flex items-center justify-between">
              {/* Left: Back Button */}
              <div className="flex items-center gap-2 w-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-foreground"
                  onClick={handleBackClick}
                  title="Go back"
                >
                  <Icon name="ChevronLeft" size={20} />
                </Button>
              </div>

              {/* Center: Logo */}
              <div className="flex items-center cursor-pointer" onClick={() => router.push('/')}>
                <Logo
                  size="lg"
                  priority={true}
                  styled={true}
                  clickable={true}
                />
              </div>

              {/* Right: Share button */}
              <div className="flex items-center gap-2 w-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-foreground"
                  title="Share profile"
                  onClick={handleShareClick}
                >
                  <Icon name="Share" size={20} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
