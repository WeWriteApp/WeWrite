"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from "../ui/button";
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '../../providers/AuthProvider';
import { useRouter, usePathname } from "next/navigation";
import { useNavigationOrder } from '../../contexts/NavigationOrderContext';
import DraggableSidebarItem from './DraggableSidebarItem';
import { useNavigationPreloader } from '../../hooks/useNavigationPreloader';
import useOptimisticNavigation from '../../hooks/useOptimisticNavigation';
import MapEditor from "../editor/MapEditor";
import { cn } from "../../lib/utils";
import { WarningDot } from '../ui/warning-dot';
import { useBankSetupStatus } from '../../hooks/useBankSetupStatus';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useEarnings } from '../../contexts/EarningsContext';
import { useEmailVerificationStatus } from '../../hooks/useEmailVerificationStatus';
import { buildNewPageUrl } from '../../utils/pageId';
import { sanitizeUsername } from '../../utils/usernameSecurity';

// ============================================================================
// CONSTANTS
// ============================================================================

const COLLAPSED_WIDTH = 72; // px - gives room for 40px button + 16px padding each side
const EXPANDED_WIDTH = 256; // px

// ============================================================================
// CONTEXTS
// ============================================================================

interface SidebarContextType {
  isExpanded: boolean;
  isHovering: boolean;
  sidebarWidth: number;
  toggleExpanded: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isExpanded: false,
  isHovering: false,
  sidebarWidth: COLLAPSED_WIDTH,
  toggleExpanded: () => {}
});

export const useSidebarContext = () => useContext(SidebarContext);

interface EditorContextType {
  location?: { lat: number; lng: number } | null;
  setLocation?: (location: { lat: number; lng: number } | null) => void;
  onCancel?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  linkFunctionalityEnabled?: boolean;
}

const EditorContext = createContext<EditorContextType>({});

export const useEditorContext = () => useContext(EditorContext);

export const EditorProvider: React.FC<{ children: React.ReactNode } & EditorContextType> = ({
  children,
  ...editorProps
}) => (
  <EditorContext.Provider value={editorProps}>
    {children}
  </EditorContext.Provider>
);

// ============================================================================
// SIDEBAR PROVIDER
// ============================================================================

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { handleNavigationHover } = useNavigationPreloader();

  useEffect(() => {
    setIsMounted(true);
    const savedState = localStorage.getItem('unified-sidebar-expanded');
    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    }
  }, []);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('unified-sidebar-expanded', JSON.stringify(newState));
  };

  const sidebarWidth = user && (isExpanded || isHovering) ? EXPANDED_WIDTH : user ? COLLAPSED_WIDTH : 0;
  const contentOffset = user ? (isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH) : 0;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-content-offset', `${contentOffset}px`);
    }
  }, [contentOffset]);

  const contextValue: SidebarContextType = {
    isExpanded,
    isHovering,
    sidebarWidth,
    toggleExpanded
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {isMounted && user && (
        <SidebarContent
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          isHovering={isHovering}
          setIsHovering={setIsHovering}
          toggleExpanded={toggleExpanded}
          handleNavigationHover={handleNavigationHover}
        />
      )}
      {children}
    </SidebarContext.Provider>
  );
}

// ============================================================================
// DEFAULT EXPORT (backward compatibility)
// ============================================================================

export default function UnifiedSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { handleNavigationHover } = useNavigationPreloader();

  useEffect(() => {
    setIsMounted(true);
    const savedState = localStorage.getItem('unified-sidebar-expanded');
    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    }
  }, []);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('unified-sidebar-expanded', JSON.stringify(newState));
  };

  if (!isMounted) return null;

  return (
    <SidebarContent
      isExpanded={isExpanded}
      setIsExpanded={setIsExpanded}
      isHovering={isHovering}
      setIsHovering={setIsHovering}
      toggleExpanded={toggleExpanded}
      handleNavigationHover={handleNavigationHover}
    />
  );
}

// ============================================================================
// SIDEBAR CONTENT
// ============================================================================

interface SidebarContentProps {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  isHovering: boolean;
  setIsHovering: (value: boolean) => void;
  toggleExpanded: () => void;
  handleNavigationHover: (href: string) => void;
}

function SidebarContent({
  isExpanded,
  setIsHovering,
  isHovering,
  toggleExpanded,
  handleNavigationHover
}: SidebarContentProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const editorContext = useContext(EditorContext);
  const { sidebarOrder, setSidebarOrder, resetSidebarOrder } = useNavigationOrder();
  const { hasActiveSubscription } = useSubscription();
  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useEarnings();
  const emailVerificationStatus = useEmailVerificationStatus();
  const { handleButtonPress, isNavigatingTo, targetRoute } = useOptimisticNavigation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Computed states
  const showContent = isExpanded || isHovering;
  const isEditMode = !!(editorContext.onSave && editorContext.onCancel);
  const isUserAdmin = user?.isAdmin === true;

  // Settings warning status
  const criticalSettingsStatus = (() => {
    const hasEmailVerificationNeeded = emailVerificationStatus.needsVerification && emailVerificationStatus.isModalDismissed;
    const hasSubscriptionWarning = hasActiveSubscription !== null && hasActiveSubscription === false;
    const hasBankSetupWarning = earnings?.hasEarnings && !bankSetupStatus.loading && !bankSetupStatus.isSetup;

    if (hasSubscriptionWarning || hasBankSetupWarning) return 'warning';
    if (hasEmailVerificationNeeded) return 'info';
    return null;
  })();

  // Navigation config
  const navigationItemsConfig: Record<string, { icon: string; label: string; href: string; action?: () => void }> = {
    'home': { icon: 'Home', label: 'Home', href: '/' },
    'search': { icon: 'Search', label: 'Search', href: '/search' },
    'new': { icon: 'Plus', label: 'New Page', href: '/new', action: () => router.push(buildNewPageUrl()) },
    'notifications': { icon: 'Bell', label: 'Notifications', href: '/notifications' },
    'map': { icon: 'Map', label: 'Map', href: '/map' },
    'leaderboard': { icon: 'Trophy', label: 'Leaderboards', href: '/leaderboard' },
    'random-pages': { icon: 'Shuffle', label: 'Random', href: '/random-pages' },
    'trending-pages': { icon: 'TrendingUp', label: 'Trending', href: '/trending-pages' },
    'following': { icon: 'Heart', label: 'Following', href: '/following' },
    'recents': { icon: 'Clock', label: 'Recents', href: '/recents' },
    'invite': { icon: 'UserPlus', label: 'Invite Friends', href: '/invite' },
    'profile': { icon: 'User', label: 'Profile', href: user ? `/u/${user.uid}` : '/auth/login' },
    'settings': { icon: 'Settings', label: 'Settings', href: '/settings' },
    ...(isUserAdmin ? { 'admin': { icon: 'Shield', label: 'Admin', href: '/admin' } } : {}),
  };

  // Build ordered nav items
  const allAvailableItems = Object.keys(navigationItemsConfig);
  const completeSidebarOrder = [
    ...sidebarOrder.filter(itemId => navigationItemsConfig[itemId]),
    ...allAvailableItems.filter(itemId => !sidebarOrder.includes(itemId))
  ];

  const reorderCompleteItems = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...completeSidebarOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);
    setSidebarOrder(newOrder.filter(itemId => navigationItemsConfig[itemId]));
  };

  const isNavItemActive = (item: { href: string; label: string }) => {
    if (!item.href) return false;

    // If we're optimistically navigating somewhere, only that target should be active
    if (targetRoute) {
      return isNavigatingTo(item.href);
    }

    // Home should match "/", "/home", and empty pathname (initial load)
    if (item.label === 'Home' && (pathname === '/' || pathname === '/home' || pathname === '')) return true;
    if (pathname === item.href) return true;
    if (item.label === 'Profile' && user && pathname.startsWith(`/u/${user.uid}`)) return true;
    if (item.label === 'Settings' && pathname.startsWith('/settings')) return true;
    if (item.label === 'Admin' && pathname.startsWith('/admin')) return true;
    return false;
  };

  const handleNavItemClick = (item: { href: string; label: string; action?: () => void }) => {
    if (item.action) {
      item.action();
    } else if (item.href) {
      if (pathname === item.href) return;
      if (isHovering && !isExpanded) setIsHovering(false);
      handleButtonPress(item.label.toLowerCase(), item.href);
    }
  };

  const handleLogoutClick = async () => {
    const confirmed = window.confirm('Are you sure you want to log out?');
    if (confirmed) {
      setIsLoggingOut(true);
      try {
        await signOut();
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  // ============================================================================
  // RENDER - Clean, simple structure
  // ============================================================================

  const sidebarContent = (
    <DndProvider backend={HTML5Backend}>
      <aside
        className={cn(
          // Base positioning
          "hidden md:flex fixed left-0 top-0 h-screen flex-col",
          "z-fixed-toolbar",
          // Simple styling - NO wewrite-card to avoid hidden rules
          "bg-background/80 backdrop-blur-md border-r border-border",
          // Width transition
          "transition-[width] duration-300 ease-out",
          showContent ? "w-64" : "w-[72px]"
        )}
        style={{
          top: 'var(--email-banner-height, 0px)',
          height: 'calc(100vh - var(--email-banner-height, 0px))',
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/*
          SIMPLE LAYOUT:
          - Fixed 16px padding on all sides
          - Collapsed: 72px total width = 16px + 40px button + 16px
          - This ensures buttons never touch edges and rounded corners are visible
          - Nav section is scrollable when content overflows
        */}
        <div className="flex flex-col h-full p-4 overflow-hidden">

          {/* Header */}
          <div className="flex items-center h-10 mb-4">
            <button
              onClick={toggleExpanded}
              className={cn(
                "h-10 w-10 flex items-center justify-center rounded-lg",
                "text-foreground hover:bg-muted transition-colors"
              )}
              aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              <Icon
                name="ChevronRight"
                size={20}
                className={cn(
                  "transition-transform duration-300",
                  isExpanded && "rotate-180"
                )}
              />
            </button>
            {showContent && (
              <span className="ml-3 text-lg font-semibold whitespace-nowrap">
                {isEditMode ? "Editor" : "WeWrite"}
              </span>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide">
            <div className={cn(
              "flex flex-col gap-1",
              !showContent && "items-center"
            )}>
              {completeSidebarOrder
                .filter((itemId, i, arr) => arr.indexOf(itemId) === i)
                .map((itemId, index) => {
                  const item = navigationItemsConfig[itemId];
                  if (!item) return null;

                  const isActive = isNavItemActive(item);
                  const isSettings = item.label === 'Settings';

                  return (
                    <DraggableSidebarItem
                      key={itemId}
                      id={itemId}
                      icon={item.icon}
                      label={item.label}
                      href={item.href}
                      onClick={() => handleNavItemClick(item)}
                      onMouseEnter={() => handleNavigationHover(item.href)}
                      isActive={isActive}
                      index={index}
                      moveItem={reorderCompleteItems}
                      showContent={showContent}
                    >
                      {isSettings && criticalSettingsStatus && (
                        <>
                          {!showContent && (
                            <WarningDot
                              variant="warning"
                              size="sm"
                              position="top-right"
                              offset={{ top: '-4px', right: '-4px' }}
                            />
                          )}
                          {showContent && (
                            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse ml-auto" />
                          )}
                        </>
                      )}
                    </DraggableSidebarItem>
                  );
                })}
            </div>

            {/* Reset button - expanded only */}
            {showContent && (
              <div className="mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetSidebarOrder}
                  className="w-full text-xs text-muted-foreground"
                >
                  Reset to default
                </Button>
              </div>
            )}

            {/* Editor controls */}
            {isEditMode && (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <div className={cn("flex", !showContent && "justify-center")}>
                  <MapEditor
                    location={editorContext.location}
                    onChange={editorContext.setLocation}
                    compact={!showContent}
                  />
                </div>
                <div className="flex flex-col gap-2 mt-auto">
                  <Button
                    onClick={editorContext.onSave}
                    disabled={editorContext.isSaving}
                    variant="success"
                    size={showContent ? "default" : "icon"}
                  >
                    <Icon name="Check" size={16} />
                    {showContent && <span className="ml-2">{editorContext.isSaving ? "Saving..." : "Save"}</span>}
                  </Button>
                  <Button
                    onClick={editorContext.onCancel}
                    variant="secondary"
                    size={showContent ? "default" : "icon"}
                  >
                    <Icon name="X" size={16} />
                    {showContent && <span className="ml-2">Cancel</span>}
                  </Button>
                  {editorContext.onDelete && (
                    <Button
                      onClick={editorContext.onDelete}
                      disabled={editorContext.isSaving}
                      variant="destructive"
                      size={showContent ? "default" : "icon"}
                    >
                      <Icon name="Trash2" size={16} />
                      {showContent && <span className="ml-2">Delete</span>}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </nav>

          {/* Footer - User/Logout */}
          {!isEditMode && user && (
            <div className={cn(
              "pt-4 border-t border-border",
              !showContent && "flex flex-col items-center"
            )}>
              {showContent && (
                <div className="mb-2 text-sm font-medium text-foreground truncate">
                  {sanitizeUsername(user.username, 'Loading...', 'User')}
                </div>
              )}
              <Button
                onClick={handleLogoutClick}
                variant="destructive-ghost"
                className={cn(
                  "h-10",
                  showContent ? "w-full justify-start" : "w-10 p-0"
                )}
                title={!showContent ? "Log out" : undefined}
              >
                <Icon name="LogOut" size={20} />
                {showContent && <span className="ml-1">Log out</span>}
              </Button>
            </div>
          )}
        </div>
      </aside>
    </DndProvider>
  );

  return createPortal(sidebarContent, document.body);
}
