"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  Home, Search, User, Settings, ChevronLeft, ChevronRight, Bell, Plus,
  Link as LinkIcon, X, Check, Trash2, MapPin, Shield,
  Clock, Shuffle, LogOut, TrendingUp, Heart, DollarSign
} from "lucide-react";
import { useAuth } from '../../providers/AuthProvider';
import { useRouter, usePathname } from "next/navigation";
import { useNavigationOrder } from '../../contexts/NavigationOrderContext';
import DraggableSidebarItem from './DraggableSidebarItem';
import { useNavigationPreloader } from '../../hooks/useNavigationPreloader';

import MapEditor from "../editor/MapEditor";

import { cn } from "../../lib/utils";
import { WarningDot } from '../ui/warning-dot';
import { StatusIcon } from '../ui/status-icon';
import { CheckCircle } from 'lucide-react';
import { useBankSetupStatus } from '../../hooks/useBankSetupStatus';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useEarnings } from '../../contexts/EarningsContext';
import { ConfirmationModal } from '../utils/ConfirmationModal';
import { sanitizeUsername } from '../../utils/usernameSecurity';

// Context for sidebar state management
interface SidebarContextType {
  isExpanded: boolean;
  isHovering: boolean;
  sidebarWidth: number;
  toggleExpanded: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isExpanded: false,
  isHovering: false,
  sidebarWidth: 64,
  toggleExpanded: () => {}
});

export const useSidebarContext = () => useContext(SidebarContext);

// Context for editor functions
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
}) => {
  return (
    <EditorContext.Provider value={editorProps}>
      {children}
    </EditorContext.Provider>
  );
};

/**
 * Sidebar Provider Component
 * Provides sidebar state to the entire app
 */
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isMounted, setIsMounted] = useState(false);


  // Load sidebar state from localStorage and handle mounting
  useEffect(() => {
    setIsMounted(true);
    const savedState = localStorage.getItem('unified-sidebar-expanded');
    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    }
  }, []);

  // Toggle function that updates state and localStorage
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('unified-sidebar-expanded', JSON.stringify(newState));
  };

  // Calculate sidebar width based on state - only for authenticated users
  const sidebarWidth = user && (isExpanded || isHovering) ? 256 : user ? 64 : 0;

  const contextValue: SidebarContextType = {
    isExpanded,
    isHovering,
    sidebarWidth,
    toggleExpanded
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* Only render sidebar for authenticated users and not on admin dashboard */}
      {isMounted && user && <UnifiedSidebarContent isExpanded={isExpanded} setIsExpanded={setIsExpanded} isHovering={isHovering} setIsHovering={setIsHovering} toggleExpanded={toggleExpanded} />}
      {children}
    </SidebarContext.Provider>
  );
}

/**
 * Default export - just the sidebar content (for backward compatibility)
 */
export default function UnifiedSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // 🚀 OPTIMIZATION: Navigation preloader for smooth navigation
  const { handleNavigationHover } = useNavigationPreloader();


  // Load sidebar state from localStorage and handle mounting
  useEffect(() => {
    setIsMounted(true);
    const savedState = localStorage.getItem('unified-sidebar-expanded');
    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    }
  }, []);

  // Toggle function for standalone usage
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('unified-sidebar-expanded', JSON.stringify(newState));
  };

  if (!isMounted) {
    return null;
  }

  return <UnifiedSidebarContent isExpanded={isExpanded} setIsExpanded={setIsExpanded} isHovering={isHovering} setIsHovering={setIsHovering} toggleExpanded={toggleExpanded} />;
}

/**
 * UnifiedSidebar Content Component
 * The actual sidebar implementation
 */
function UnifiedSidebarContent({
  isExpanded,
  setIsExpanded,
  isHovering,
  setIsHovering,
  toggleExpanded
}: {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  isHovering: boolean;
  setIsHovering: (value: boolean) => void;
  toggleExpanded: () => void;
}) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const editorContext = useContext(EditorContext);
  const { sidebarOrder, reorderSidebarItem, setSidebarOrder, resetSidebarOrder } = useNavigationOrder();
  const { hasActiveSubscription } = useSubscription();
  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useEarnings();

  // Derive subscription warning state
  const shouldShowSubscriptionWarning = hasActiveSubscription === false;

  // Calculate the most critical status from all settings sections
  const getMostCriticalSettingsStatus = () => {
    // Payments are always enabled

    // Check for warnings first (most critical)
    const hasSubscriptionWarning = hasActiveSubscription !== null && hasActiveSubscription === false;
    // Only show bank setup warning if user has funds but bank isn't set up (and not loading)
    const hasBankSetupWarning = earnings?.hasEarnings && !bankSetupStatus.loading && !bankSetupStatus.isSetup;

    if (hasSubscriptionWarning || hasBankSetupWarning) {
      return 'warning';
    }

    // If no warnings and we have data, don't show any icon (success is hidden)
    if (hasActiveSubscription !== null) {
      return null; // Hide success status
    }

    return null;
  };

  const criticalSettingsStatus = getMostCriticalSettingsStatus();

  // Debug subscription status (console only, less spammy)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[UnifiedSidebar] Subscription status:', {
        hasActiveSubscription,
        shouldShowSubscriptionWarning,
        bankSetupStatus: { isSetup: bankSetupStatus.isSetup, loading: bankSetupStatus.loading },
        criticalSettingsStatus
      });
    }
  }, [hasActiveSubscription, shouldShowSubscriptionWarning, bankSetupStatus.isSetup, criticalSettingsStatus]);

  // Map feature is now always enabled
  const mapFeatureEnabled = true;

  // Logout confirmation modal state
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Check if account is admin
  const isUserAdmin = user?.email === 'jamiegray2234@gmail.com' || user?.email === 'jamie@wewrite.app' || user?.email === 'admin.test@wewrite.app';

  // Handle logout confirmation
  const handleLogoutClick = async () => {
    // CRITICAL FIX: Use system dialog instead of custom WeWrite dialog
    const confirmed = window.confirm('Are you sure you want to log out? You\'ll need to sign in again to access your account.');

    if (confirmed) {
      setIsLoggingOut(true);
      try {
        console.log('🔴 SIDEBAR: Logout confirmed, calling signOut function');
        await signOut();
        console.log('🔴 SIDEBAR: signOut completed successfully');
      } catch (error) {
        console.error('🔴 SIDEBAR: Error during logout:', error);
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  // Check if we're on admin dashboard (should hide sidebar)
  const isAdminDashboard = pathname === '/admin/dashboard';

  // Don't render sidebar on admin dashboard
  if (isAdminDashboard) {
    return null;
  }

  // Determine if we're in edit mode (editor functions are available)
  const isEditMode = !!(editorContext.onSave && editorContext.onCancel);

  // Determine if sidebar should show content (expanded or hovering)
  const showContent = isExpanded || isHovering;

  // Navigation items configuration
  const navigationItemsConfig = {
    'home': { icon: Home, label: 'Home', href: '/' },
    'search': { icon: Search, label: 'Search', href: '/search' },
    'new': { icon: Plus, label: 'New Page', href: '/new' },
    'notifications': { icon: Bell, label: 'Notifications', href: '/notifications' },
    'random-pages': { icon: Shuffle, label: 'Random', href: '/random-pages' },
    'trending-pages': { icon: TrendingUp, label: 'Trending', href: '/trending-pages' },
    'following': { icon: Heart, label: 'Following', href: '/following' },
    'recents': { icon: Clock, label: 'Recents', href: '/recents' },
    'profile': { icon: User, label: 'Profile', href: user ? `/user/${user.uid}` : '/auth/login' },
    'settings': { icon: Settings, label: 'Settings', href: '/settings' },
    // Admin Dashboard - only for admin users
    ...(isUserAdmin ? { 'admin': { icon: Shield, label: 'Admin', href: '/admin' } } : {}),
  };

  // Build ordered navigation items - ensure ALL items are shown
  // First, get all available items from config
  const allAvailableItems = Object.keys(navigationItemsConfig);

  // Create a complete sidebar order that includes all items
  const completeSidebarOrder = [
    ...sidebarOrder.filter(itemId => navigationItemsConfig[itemId]), // Keep existing order for known items
    ...allAvailableItems.filter(itemId => !sidebarOrder.includes(itemId)) // Add any missing items at the end
  ];

  // Custom reorder function that works with the complete order
  const reorderCompleteItems = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...completeSidebarOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);

    // Update the context with the new complete order
    // Filter out any items that shouldn't be in the sidebar context
    const newSidebarOrder = newOrder.filter(itemId => navigationItemsConfig[itemId]);
    setSidebarOrder(newSidebarOrder);
  };

  const navItems = completeSidebarOrder
    .map(itemId => navigationItemsConfig[itemId])
    .filter(Boolean); // Remove any undefined items

  // Check if navigation item is active
  const isNavItemActive = (item: any) => {
    if (!item.href) return false;

    // Exact match for most routes
    if (pathname === item.href) return true;

    // Special case for profile - match account profile pages
    if (item.label === 'Profile' && user && pathname.startsWith(`/user/${user.uid}`)) {
      return true;
    }

    return false;
  };

  // Handle navigation item click
  const handleNavItemClick = (item: any) => {
    if (item.action) {
      item.action();
    } else if (item.href) {
      // If we're in a temporary hover state (not persistently expanded),
      // end the hover state before navigation
      if (isHovering && !isExpanded) {
        setIsHovering(false);
      }
      router.push(item.href);
    }
  };

  // Render the sidebar
  const sidebarContent = (
    <DndProvider backend={HTML5Backend}>
      {/* Desktop Sidebar - Hidden on mobile */}
      <div
        className={cn(
          "hidden md:flex fixed left-0 top-0 h-screen z-fixed-toolbar flex-col",
          // Use full wewrite-card system (includes glassmorphism backdrop blur)
          "wewrite-card border-r border-[var(--card-border)]",
          // Remove rounded corners for sidebar
          "!rounded-none",
          "sidebar-smooth-transition overflow-hidden", // Prevent any overflow
          showContent ? "w-64" : "w-16",
          isHovering && !isExpanded ? "sidebar-hover-overlay" : ""
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className={cn(
          "flex flex-col h-full",
          showContent ? "p-4" : "py-4 px-1"
        )}>
          {/* Header with toggle button - Fixed at top */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            {showContent && (
              <h3 className="text-lg font-semibold text-foreground transition-opacity duration-300">
                {isEditMode ? "Editor" : "WeWrite"}
              </h3>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleExpanded}
              className="ml-auto text-foreground hover:bg-primary/10 hover:text-primary transition-all duration-300 w-8 h-8"
              aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isExpanded ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Scrollable content area */}
          <div className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden",
            "scrollbar-hide" // Hide scrollbars completely
          )}>
            {/* Navigation Items */}
            <nav className={cn(
              "flex flex-col gap-2 mb-6",
              // IMPORTANT: Add horizontal padding for collapsed state to center icons properly
              // This works with NavButton w-full to prevent icon clipping
              // Collapsed: w-16 sidebar - px-2 container = 48px button width (perfect for icons)
              !showContent && "px-2"
            )}>
            {completeSidebarOrder
              .filter((itemId, index, array) => array.indexOf(itemId) === index) // Remove duplicates
              .map((itemId, index) => {
                const item = navigationItemsConfig[itemId];
                if (!item) return null;

                const isActive = isNavItemActive(item);
                const isSettings = item.label === 'Settings';

                return (
                  <DraggableSidebarItem
                    key={`desktop-sidebar-${itemId}-${index}`} // Add index to ensure uniqueness
                    id={itemId}
                    icon={item.icon}
                    label={item.label}
                    href={item.href}
                    onClick={() => handleNavItemClick(item)}
                    onMouseEnter={() => handleNavigationHover(item.href)} // 🚀 Preload on hover
                    isActive={isActive}
                    index={index}
                    moveItem={reorderCompleteItems}
                    showContent={showContent}
                    isCompact={false}
                  >
                    {/* Settings warning indicator */}
                    {isSettings && criticalSettingsStatus === 'warning' && (
                      <>
                        {!showContent && (
                          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full"></div>
                        )}
                        {showContent && (
                          <StatusIcon
                            status="warning"
                            size="sm"
                            position="static"
                          />
                        )}
                      </>
                    )}
                  </DraggableSidebarItem>
                );
              })}
          </nav>

          {/* Reset to Default Button - only show when expanded */}
          {showContent && (
            <div className="mt-auto mb-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={resetSidebarOrder}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                Reset to default
              </Button>
            </div>
          )}

          {/* Editor Functions (only show in edit mode) */}
          {isEditMode && (
            <>
              {/* Divider */}
              <div className="border-t border-border mb-4" />
              
              <div className="flex flex-col gap-4 flex-1">


                {/* Insert Link button removed - editing controls should only be in editing contexts */}

                {/* Location button - only show if map feature is enabled */}
                {mapFeatureEnabled && (
                  <div className={cn("flex", !showContent && "justify-center")}>
                    <MapEditor
                      location={editorContext.location}
                      onChange={editorContext.setLocation}
                      compact={!showContent}
                    />
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action buttons at bottom */}
                <div className="flex flex-col gap-2">
                  {/* Mobile: Save button first, Desktop: Save button last */}
                  <div className={cn(
                    "flex gap-2",
                    showContent ? "md:flex-row-reverse md:justify-start" : "flex-col"
                  )}>
                    {/* Save button */}
                    <Button
                      onClick={editorContext.onSave}
                      disabled={editorContext.isSaving}
                      variant="success"
                      className={cn(
                        "flex items-center gap-3 h-auto p-3 justify-start",
                        !showContent && "justify-center w-12 h-12 p-0",
                        showContent && "md:order-last"
                      )}
                      title={showContent ? "" : "Save"}
                    >
                      <Check className="h-4 w-4 flex-shrink-0" />
                      {showContent && (
                        <span className="font-medium transition-opacity duration-200">
                          {editorContext.isSaving ? "Saving..." : "Save"}
                        </span>
                      )}
                    </Button>

                    {/* Cancel button */}
                    <Button
                      onClick={editorContext.onCancel}
                      variant="secondary"
                      className={cn(
                        "flex items-center gap-3 h-auto p-3 justify-start",
                        !showContent && "justify-center w-12 h-12 p-0"
                      )}
                      title={showContent ? "" : "Cancel"}
                    >
                      <X className="h-4 w-4 flex-shrink-0" />
                      {showContent && <span className="font-medium transition-opacity duration-200">Cancel</span>}
                    </Button>
                  </div>

                  {/* Delete button (only show if onDelete is provided) */}
                  {editorContext.onDelete && (
                    <Button
                      onClick={editorContext.onDelete}
                      disabled={editorContext.isSaving}
                      variant="destructive"
                      className={cn(
                        "flex items-center gap-3 h-auto p-3 justify-start",
                        !showContent && "justify-center w-12 h-12 p-0"
                      )}
                      title={showContent ? "" : "Delete"}
                    >
                      <Trash2 className="h-4 w-4 flex-shrink-0" />
                      {showContent && <span className="font-medium transition-opacity duration-200">Delete</span>}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
          </div>

          {/* Fixed bottom section - Fund Account button for users without active subscription */}
          {!isEditMode && user && hasActiveSubscription === false && (
            <div className="px-3 pb-4 flex-shrink-0">
              <Button
                onClick={() => router.push('/settings/fund-account')}
                className={cn(
                  "bg-green-600 hover:bg-green-700 text-white font-medium",
                  showContent ? "w-full" : "w-10 h-10 p-0"
                )}
                size={showContent ? "sm" : "icon"}
                title={showContent ? "" : "Fund Account"}
              >
                <DollarSign className={cn("h-4 w-4", showContent && "mr-2")} />
                {showContent && "Fund Account"}
              </Button>
            </div>
          )}

          {/* Fixed bottom section - User info and logout at bottom for non-edit mode */}
          {!isEditMode && user && (
            <div className="mt-auto pt-4 border-t border-border flex-shrink-0">
              {/* User Information - only show when expanded */}
              {showContent && (
                <div className="mb-3 px-3 py-2">
                  <div className="text-sm font-medium text-foreground truncate">
                    {sanitizeUsername(user.username, 'Loading...', 'User')}
                  </div>
                </div>
              )}

              {/* Logout Button */}
              {showContent ? (
                <Button
                  variant="ghost"
                  onClick={handleLogoutClick}
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={handleLogoutClick}
                  className={cn(
                    "relative flex items-center h-12 w-full text-foreground hover:bg-primary/10 hover:text-primary transition-all duration-300 sidebar-nav-button",
                    showContent && "sidebar-nav-button-expanded"
                  )}
                  title="Logout"
                >
                  {/* Icon container - maintains position during transitions */}
                  <div className="sidebar-icon-container">
                    <LogOut className="h-5 w-5 flex-shrink-0" />
                  </div>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </DndProvider>
  );

  // Use portal to render sidebar at document root level
  return (
    <>
      {createPortal(sidebarContent, document.body)}

      {/* Logout confirmation now uses system dialog - no custom modal needed */}
    </>
  );
}