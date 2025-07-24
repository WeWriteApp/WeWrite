"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  Home, Search, User, Settings, ChevronLeft, ChevronRight, Bell, Plus,
  Link as LinkIcon, X, Check, Trash2, MapPin, Shield,
  Clock, Shuffle, LogOut, TrendingUp, Heart
} from "lucide-react";
import { useAuth } from '../../providers/AuthProvider';
import { useRouter, usePathname } from "next/navigation";

import MapEditor from "../editor/MapEditor";

import { cn } from "../../lib/utils";
import { WarningDot } from '../ui/warning-dot';
import { StatusIcon } from '../ui/status-icon';
import { useSubscriptionWarning } from '../../hooks/useSubscriptionWarning';
import { CheckCircle } from 'lucide-react';
import { useBankSetupStatus } from '../../hooks/useBankSetupStatus';
import { useUserEarnings } from '../../hooks/useUserEarnings';
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
  const { shouldShowWarning: shouldShowSubscriptionWarning, warningVariant, hasActiveSubscription } = useSubscriptionWarning();
  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useUserEarnings();

  // Calculate the most critical status from all settings sections
  const getMostCriticalSettingsStatus = () => {
    // Payments are always enabled

    // Check for warnings first (most critical)
    const hasSubscriptionWarning = hasActiveSubscription !== null && hasActiveSubscription === false;
    // Only show bank setup warning if user has funds but bank isn't set up
    const hasBankSetupWarning = earnings?.hasEarnings && !bankSetupStatus.isSetup;

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
        warningVariant,
        bankSetupStatus: bankSetupStatus.isSetup,
        criticalSettingsStatus
      });
    }
  }, [hasActiveSubscription, shouldShowSubscriptionWarning, warningVariant, bankSetupStatus.isSetup, criticalSettingsStatus]);

  // Map feature is now always enabled
  const mapFeatureEnabled = true;

  // Logout confirmation modal state
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Check if account is admin
  const isUserAdmin = user?.email === 'jamiegray2234@gmail.com' || user?.email === 'jamie@wewrite.app' || user?.email === 'admin.test@wewrite.app';

  // Handle logout confirmation
  const handleLogoutClick = () => {
    setShowLogoutConfirmation(true);
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      console.log('🔴 SIDEBAR: Logout confirmed, calling signOut function');
      await signOut();
      console.log('🔴 SIDEBAR: signOut completed successfully');
    } catch (error) {
      console.error('🔴 SIDEBAR: Error during logout:', error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirmation(false);
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirmation(false);
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

  // Navigation items
  // Build navigation items based on account state
  const navItems = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Search, label: 'Search', href: '/search' },
    { icon: Shuffle, label: 'Random Pages', href: '/random-pages' },
    { icon: TrendingUp, label: 'Trending Pages', href: '/trending-pages' },
    { icon: Clock, label: 'Recently viewed', href: '/recents' },
    { icon: Heart, label: 'Following', href: '/following' },
    { icon: Plus, label: 'New Page', href: '/new' },
    { icon: Bell, label: 'Notifications', href: '/notifications' },
    { icon: User, label: 'Profile', href: user ? `/user/${user.uid}` : '/auth/login' },
    { icon: Settings, label: 'Settings', href: '/settings' },
    // Admin Dashboard - only for admin users
    ...(isUserAdmin ? [{ icon: Shield, label: 'Admin Dashboard', href: '/admin' }] : []),
  ];

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
    /* Desktop Sidebar - Hidden on mobile */
    <div
      className={cn(
        "hidden md:flex fixed left-0 top-0 h-screen bg-background border-r border-border z-[100] flex-col",
        "sidebar-smooth-transition",
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
          {/* Header with toggle button */}
          <div className="flex items-center justify-between mb-6">
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

          {/* Navigation Items */}
          <nav className="flex flex-col gap-2 mb-6">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isRandomPage = item.label === 'Random Pages';
              const isActive = isNavItemActive(item);
              const isSettings = item.label === 'Settings';

              const buttonContent = (
                <Button
                  variant="ghost"
                  onClick={() => handleNavItemClick(item)}
                  className={cn(
                    "relative flex items-center h-12 w-full transition-all duration-300 ease-in-out",
                    "text-foreground hover:bg-primary/10 hover:text-primary",
                    "sidebar-nav-button",
                    showContent && "sidebar-nav-button-expanded",
                    // Active state styling
                    isActive && "bg-primary/10 text-primary"
                  )}
                  title={showContent ? "" : item.label}
                >
                    {/* Icon container - maintains position during transitions */}
                    <div className={cn(
                      "sidebar-icon-container relative inline-block",
                      showContent && "mr-3"
                    )}>
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {isSettings && criticalSettingsStatus === 'warning' && !showContent && (
                        // Small warning dot when collapsed
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full"></div>
                      )}
                    </div>

                    {/* Text label - slides in from the right */}
                    <div className={cn(
                      "sidebar-text-container flex-1 flex items-center justify-between",
                      showContent ? "opacity-100 max-w-none" : "opacity-0 max-w-0"
                    )}>
                      <span className="font-medium whitespace-nowrap text-left">
                        {item.label}
                      </span>
                      {isSettings && criticalSettingsStatus === 'warning' && showContent && (
                        <StatusIcon
                          status="warning"
                          size="sm"
                          position="static"
                        />
                      )}
                    </div>
                  </Button>
              );

              return (
                <div key={item.href || index}>
                  {buttonContent}
                </div>
              );
            })}
          </nav>



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
                      variant="outline"
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

          {/* User info and logout at bottom for non-edit mode */}
          {!isEditMode && user && (
            <div className="mt-auto pt-4 border-t border-border">
              {/* User Information - only show when expanded */}
              {showContent && (
                <div className="mb-3 px-3 py-2">
                  <div className="text-sm font-medium text-foreground truncate">
                    {sanitizeUsername(user.username, 'Loading...', 'User')}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email}
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
  );

  // Use portal to render sidebar at document root level
  return (
    <>
      {createPortal(sidebarContent, document.body)}

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={showLogoutConfirmation}
        onClose={handleLogoutCancel}
        onConfirm={handleLogoutConfirm}
        title="Confirm Logout"
        message="Are you sure you want to log out? You'll need to sign in again to access your account."
        confirmText="Log Out"
        cancelText="Cancel"
        variant="default"
        icon="logout"
        isLoading={isLoggingOut}
      />
    </>
  );
}