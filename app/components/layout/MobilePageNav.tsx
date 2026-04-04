'use client';

/**
 * MobilePageNav
 *
 * Full-page mobile navigation layout with sliding transitions.
 * Used by Settings and Admin on mobile to show a menu list,
 * and slide in sub-page content when a section is tapped.
 *
 * Features:
 * - Header with back button (left) and title (center)
 * - Menu list view showing all sections
 * - Slide-left transition when entering a sub-page
 * - Slide-right transition when going back via back button
 * - URL-driven: uses Next.js pathname to determine active view
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { WeWriteLogo } from '../ui/WeWriteLogo';
import { WarningDot } from '../ui/warning-dot';
import { cn } from '../../lib/utils';

const TRANSITION_DURATION = 250;

export interface MobileNavSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  description?: string;
  statusIndicator?: React.ReactNode;
  showWarning?: boolean;
  warningVariant?: 'warning' | 'error' | 'critical';
  isPrimary?: boolean;
}

interface MobilePageNavProps {
  /** Base path (e.g., '/settings', '/admin') */
  basePath: string;
  /** Navigation sections */
  sections: MobileNavSection[];
  /** Page title shown in header when at menu root */
  title: string;
  /** The sub-page content (Next.js children from layout) */
  children: React.ReactNode;
  /** Optional header content between header and menu (e.g., data source toggle) */
  headerExtra?: React.ReactNode;
}

/**
 * Resolve the display title for the current sub-page
 */
function getSubPageTitle(pathname: string, basePath: string, sections: MobileNavSection[]): string {
  // Find matching section by href
  const match = sections.find(s => pathname === s.href || pathname.startsWith(s.href + '/'));
  return match?.title || '';
}

export function MobilePageNav({ basePath, sections, title, children, headerExtra }: MobilePageNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Determine if we're at the menu root or a sub-page
  const isAtRoot = pathname === basePath || pathname === basePath + '/';
  const subPageTitle = isAtRoot ? '' : getSubPageTitle(pathname, basePath, sections);

  // Track the direction for animation
  const [direction, setDirection] = useState<'forward' | 'back' | null>(null);
  const [showMenu, setShowMenu] = useState(isAtRoot);
  const [showContent, setShowContent] = useState(!isAtRoot);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevPathnameRef = useRef(pathname);

  // When pathname changes, trigger the appropriate animation
  useEffect(() => {
    const wasAtRoot = prevPathnameRef.current === basePath || prevPathnameRef.current === basePath + '/';
    const nowAtRoot = pathname === basePath || pathname === basePath + '/';
    prevPathnameRef.current = pathname;

    if (wasAtRoot && !nowAtRoot) {
      // Navigating forward: menu -> sub-page
      setDirection('forward');
      setShowContent(true);
      setIsAnimating(true);
      setTimeout(() => {
        setShowMenu(false);
        setIsAnimating(false);
        setDirection(null);
      }, TRANSITION_DURATION);
    } else if (!wasAtRoot && nowAtRoot) {
      // Navigating back: sub-page -> menu
      setDirection('back');
      setShowMenu(true);
      setIsAnimating(true);
      setTimeout(() => {
        setShowContent(false);
        setIsAnimating(false);
        setDirection(null);
      }, TRANSITION_DURATION);
    } else if (!nowAtRoot) {
      // Sub-page to sub-page (e.g., deep link or direct navigation)
      setShowMenu(false);
      setShowContent(true);
      setDirection(null);
      setIsAnimating(false);
    } else {
      // Already at root
      setShowMenu(true);
      setShowContent(false);
      setDirection(null);
      setIsAnimating(false);
    }
  }, [pathname, basePath]);

  const handleBack = useCallback(() => {
    if (isAtRoot) {
      // Always go home from root — avoids back-button loops
      router.push('/');
    } else {
      router.push(basePath);
    }
  }, [isAtRoot, router, basePath]);

  const handleSectionClick = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fixed header — matches FinancialHeader card style */}
      <header className="sticky top-0 z-30 wewrite-card wewrite-card-sharp wewrite-card-border-bottom wewrite-card-no-padding">
        <div className="flex items-center h-14 px-4">
          {/* Back button */}
          <button
            onClick={handleBack}
            className="flex items-center gap-1 -ml-2 px-2 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
            aria-label={isAtRoot ? 'Go home' : `Back to ${title}`}
          >
            <Icon name="ChevronLeft" size={22} />
            <span className="text-sm font-medium">
              {isAtRoot ? 'Home' : title}
            </span>
          </button>

          {/* Center: Logo at root, sub-page title otherwise */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            {isAtRoot ? (
              <WeWriteLogo
                size="md"
                styled={true}
                clickable={true}
                showText={false}
                priority={true}
              />
            ) : (
              <h1 className="text-base font-semibold truncate">{subPageTitle}</h1>
            )}
          </div>

          {/* Spacer to balance the back button */}
          <div className="w-16" />
        </div>
      </header>

      {/* Content area with sliding animation */}
      <div className="flex-1 relative overflow-hidden">
        {/* Menu view */}
        {(showMenu || isAnimating) && (
          <div
            className={cn(
              "absolute inset-0 overflow-y-auto",
              "transition-transform ease-out",
              direction === 'forward' && '-translate-x-full',
              direction === 'back' && 'translate-x-0',
              !direction && (isAtRoot ? 'translate-x-0' : '-translate-x-full'),
            )}
            style={{ transitionDuration: `${TRANSITION_DURATION}ms` }}
          >
            {headerExtra && (
              <div className="px-4 pt-4 pb-1">
                {headerExtra}
              </div>
            )}
            <nav className="divide-y divide-border">
              {sections.map((section) => {
                const SectionIcon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionClick(section.href)}
                    className="w-full flex items-center justify-between px-4 py-4 text-left nav-hover-state nav-active-state transition-colors select-none touch-manipulation"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative flex-shrink-0 flex items-center justify-center w-6 h-6">
                        <SectionIcon className="h-5 w-5 text-foreground" />
                        {section.showWarning && (
                          <WarningDot
                            variant={section.warningVariant || 'warning'}
                            size="sm"
                            position="top-right"
                            offset={{ top: '-4px', right: '-4px' }}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium leading-6 block">{section.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {section.statusIndicator}
                      <Icon name="ChevronRight" size={18} className="text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Content view (sub-page) */}
        {(showContent || isAnimating) && (
          <div
            className={cn(
              "absolute inset-0 overflow-y-auto",
              "transition-transform ease-out",
              direction === 'forward' && 'translate-x-0',
              direction === 'back' && 'translate-x-full',
              !direction && (!isAtRoot ? 'translate-x-0' : 'translate-x-full'),
            )}
            style={{ transitionDuration: `${TRANSITION_DURATION}ms` }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default MobilePageNav;
