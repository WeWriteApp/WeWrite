'use client';

import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { Logo } from '../ui/Logo';
import { useSidebarContext } from '../layout/DesktopSidebar';
import { toast } from '../ui/use-toast';

export interface GroupProfileHeaderProps {
  groupId: string;
  groupName?: string;
}

/**
 * Header for group pages – matches UserProfileHeader layout:
 * Back | Logo | Share.
 */
export default function GroupProfileHeader({
  groupId,
  groupName,
}: GroupProfileHeaderProps) {
  const router = useRouter();
  const { sidebarWidth, isExpanded } = useSidebarContext();

  const headerSidebarWidth = React.useMemo(() => {
    if (isExpanded) return sidebarWidth;
    if (sidebarWidth > 0) return 64;
    return 0;
  }, [isExpanded, sidebarWidth]);

  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      router.back();
    } catch {
      window.history.back();
    }
  };

  const handleShareClick = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: groupName || 'Group',
        url,
      }).catch((err) => {
        if (err.name !== 'AbortError') console.error(err);
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast.success('Group link copied!');
      }).catch(() => {});
    }
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 w-full z-50 bg-background"
      style={{ top: 'var(--banner-stack-height, 0px)' }}
    >
      <div className="flex w-full h-full">
        <div
          className="hidden lg:block transition-all duration-300 ease-out flex-shrink-0"
          style={{ width: `${headerSidebarWidth}px` }}
        />
        <div className="flex-1 min-w-0 relative px-4 header-padding-mobile">
          <div className="py-2">
            <div className="flex items-center justify-between">
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
              <div
                className="cursor-pointer"
                onClick={() => router.push('/')}
                role="button"
                aria-label="Home"
              >
                <Logo size="lg" priority={true} styled={true} clickable={true} />
              </div>
              <div className="flex items-center gap-1 w-10 justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-foreground"
                  title="Share group"
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
