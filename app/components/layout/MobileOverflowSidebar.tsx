"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { X, ChevronLeft, Settings, Check, Users, Shield, Link as LinkIcon, Trash2, Clock, Shuffle, LogOut, Search, TrendingUp, Heart, Home, Plus, Bell, User } from "lucide-react"
import { useRouter } from "next/navigation"

// Removed direct Firebase auth imports - using user management system
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { userProfileApi } from '../../utils/apiClient';

import { useAuth } from '../../providers/AuthProvider';
import { sanitizeUsername } from '../../utils/usernameSecurity';
import { useNavigationOrder } from '../../contexts/NavigationOrderContext';
import DraggableSidebarItem from './DraggableSidebarItem';
import CrossComponentDragItem from './CrossComponentDragItem';
import CrossComponentMobileNavButton from './CrossComponentMobileNavButton';

import MapEditor from "../editor/MapEditor"
import { navigateToRandomPage } from "../../utils/randomPageNavigation"
import { WarningDot } from '../ui/warning-dot';
import { StatusIcon } from '../ui/status-icon';
import { useSubscriptionWarning } from '../../hooks/useSubscriptionWarning';
import { useBankSetupStatus } from '../../hooks/useBankSetupStatus';
import { useUserEarnings } from '../../hooks/useUserEarnings';
import ConfirmationModal from '../utils/ConfirmationModal';

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onDragStart?: () => void // Callback when drag starts to collapse sidebar
  // Editor functions (optional - only provided when in edit mode)
  editorProps?: {
    isPublic?: boolean;
    setIsPublic?: (value: boolean) => void;
    location?: { lat: number; lng: number } | null;
    setLocation?: (location: { lat: number; lng: number } | null) => void;
    onInsertLink?: () => void;
    onCancel?: () => void;
    onSave?: () => void;
    onDelete?: () => void;
    isSaving?: boolean;
    linkFunctionalityEnabled?: boolean;
  }
}

export function MobileOverflowSidebar({ isOpen, onClose, onDragStart, editorProps }: SidebarProps) {
  const router = useRouter()
  const [currentSection, setCurrentSection] = useState<string | null>(null)
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)

  const { user } = useAuth();
  const { shouldShowWarning: shouldShowSubscriptionWarning, warningVariant, hasActiveSubscription } = useSubscriptionWarning();
  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useUserEarnings();
  const { sidebarOrder, reorderSidebarItem, swapBetweenMobileAndSidebar, mobileOrder } = useNavigationOrder();

  // Reset to page 0 when mobile order changes to avoid being stuck on non-existent pages
  useEffect(() => {
    setCurrentPage(0);
  }, [mobileOrder.length]);



  // Calculate the most critical status from all settings sections (same logic as UnifiedSidebar)
  const getMostCriticalSettingsStatus = () => {
    // Payments are always enabled

    // Check for warnings first (most critical)
    const hasSubscriptionWarning = hasActiveSubscription !== null && hasActiveSubscription === false;
    // Only show bank setup warning if user has funds but bank isn't set up
    const hasBankSetupWarning = earnings?.hasEarnings && !bankSetupStatus.isSetup;

    if (hasSubscriptionWarning || hasBankSetupWarning) {
      return 'warning';
    }

    // Check for success states
    const hasActiveSubscriptionSuccess = hasActiveSubscription === true;
    const hasBankSetupSuccess = bankSetupStatus.isSetup;

    if (hasActiveSubscriptionSuccess || hasBankSetupSuccess) {
      return 'success';
    }

    return null;
  };

  const criticalSettingsStatus = getMostCriticalSettingsStatus();



  // Groups functionality removed

  // Map feature is now always enabled
  const mapFeatureEnabled = true;

  // Determine if we're in edit mode
  const isEditMode = !!(editorProps?.onSave && editorProps?.onCancel);

  // Check if user is admin
  const isUserAdmin = (userEmail?: string | null): boolean => {
    if (!userEmail) return false;
    return userEmail === 'jamiegray2234@gmail.com' || userEmail === 'jamie@wewrite.app' || userEmail === 'admin.test@wewrite.app';
  };

  // Reset to main menu when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to ensure the animation completes before resetting
      const timeout = setTimeout(() => {
        setCurrentSection(null);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen])

  // Navigation items configuration - matches desktop sidebar exactly
  // Note: 'new' removed as it's now handled by floating action button
  const navigationItemsConfig = {
    'home': { icon: Home, label: 'Home', href: '/' },
    'search': { icon: Search, label: 'Search', href: '/search' },
    'random-pages': { icon: Shuffle, label: 'Random', href: '/random-pages' },
    'trending-pages': { icon: TrendingUp, label: 'Trending', href: '/trending-pages' },
    'recents': { icon: Clock, label: 'Recents', href: '/recents' },
    'following': { icon: Heart, label: 'Following', href: '/following' },
    'notifications': { icon: Bell, label: 'Notifications', href: '/notifications' },
    'profile': { icon: User, label: 'Profile', href: user ? `/user/${user.uid}` : '/auth/login' },
    'settings': { icon: Settings, label: 'Settings', href: '/settings' },
    // Admin Dashboard - only for admin users
    ...(user && user.email && isUserAdmin(user.email) ? {
      'admin': { icon: Shield, label: 'Admin', href: '/admin' }
    } : {}),
  };

  // Handle navigation item click
  const handleNavItemClick = (item: any) => {
    onClose(); // Close sidebar first
    if (item.href) {
      router.push(item.href);
    }
  };

  // Function to navigate to a section
  const navigateToSection = (section: string) => {
    setCurrentSection(section)
  }

  // Function to go back to main menu
  const goBackToMain = () => {
    setCurrentSection(null)
  }

  // Handle cross-component drops (sidebar to mobile)
  const handleCrossComponentDrop = (
    dragItem: { id: string; index: number; sourceType: 'mobile' | 'sidebar' },
    targetIndex: number,
    targetType: 'mobile' | 'sidebar'
  ) => {
    // Collapse sidebar when drag starts
    if (onDragStart) {
      onDragStart();
    }

    // Perform the swap
    swapBetweenMobileAndSidebar(
      dragItem.sourceType,
      dragItem.index,
      targetType,
      targetIndex
    );
  };

  // Logout handlers
  const handleLogoutClick = () => {
    setShowLogoutConfirmation(true);
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      console.log('🔐 [MOBILE SIDEBAR] Logging out via API');
      const response = await userProfileApi.logout();
      if (response.success) {
        console.log('🔐 [MOBILE SIDEBAR] Logout successful');
        onClose();
      } else {
        console.error('🔐 [MOBILE SIDEBAR] Logout failed:', response.error);
      }
    } catch (error) {
      console.error('🔐 [MOBILE SIDEBAR] Logout error:', error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirmation(false);
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirmation(false);
  };

  // Swipe gesture handlers for pagination
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    const availableItems = sidebarOrder.filter(itemId => !mobileOrder.includes(itemId));
    const totalPages = Math.ceil(availableItems.length / 10);

    if (isLeftSwipe && currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
    if (isRightSwipe && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Render the appropriate section based on currentSection
  const renderSection = () => {
    switch (currentSection) {

      default:
        return (
          <div className="flex flex-col h-full">
            {/* Main Menu Items - Simple Grid Layout */}
            <div className="mb-6">
              {(() => {
                const availableItems = sidebarOrder
                  .filter(itemId => !mobileOrder.includes(itemId)) // Not in mobile toolbar
                  .filter(itemId => navigationItemsConfig[itemId]); // Item exists in config

                return (
                  <>
                    {/* Grid of all available items */}
                    <div className="grid grid-cols-5 gap-1">
                      {availableItems.map((itemId, displayIndex) => {
                        const item = navigationItemsConfig[itemId];
                        if (!item) return null;

                        // CRITICAL: Use the actual sidebar index, not the filtered display index
                        const actualSidebarIndex = sidebarOrder.indexOf(itemId);

                        const isSettings = item.label === 'Settings';

                        return (
                          <CrossComponentMobileNavButton
                            key={`mobile-overflow-${itemId}`}
                            id={itemId}
                            index={actualSidebarIndex} // Use actual sidebar index for swapping
                            icon={item.icon}
                            onClick={() => handleNavItemClick(item)}
                            onHover={() => {}} // No hover for overflow items
                            isActive={false} // Overflow items are never active
                            ariaLabel={item.label}
                            label={item.label}
                            sourceType="sidebar" // These are sidebar items in overflow
                            onCrossComponentDrop={handleCrossComponentDrop}
                            moveItem={reorderSidebarItem}
                            isPressed={false}
                            isNavigating={false}
                          >
                            {/* Settings warning indicator */}
                            {isSettings && criticalSettingsStatus === 'warning' && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-background"></div>
                            )}
                          </CrossComponentMobileNavButton>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Editor Functions (only show in edit mode) */}
            {isEditMode && (
              <>
                <div className="border-t border-border my-4" />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground px-4">Editor</h3>



                  {/* Insert Link button removed - editing controls should only be in editing contexts */}

                  {/* Location button - only show if map feature is enabled */}
                  {mapFeatureEnabled && (
                    <div className="px-4">
                      <MapEditor
                        location={editorProps?.location}
                        onChange={editorProps?.setLocation}
                        compact={false}
                      />
                    </div>
                  )}

                  {/* Delete button (only show if onDelete is provided) */}
                  {editorProps?.onDelete && (
                    <button
                      onClick={editorProps?.onDelete}
                      disabled={editorProps?.isSaving}
                      className="flex items-center w-full px-4 py-3 text-sm rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 min-h-[48px]"
                    >
                      <Trash2 className="h-5 w-5 mr-3" />
                      <span>Delete</span>
                    </button>
                  )}

                  {/* Cancel and Save buttons */}
                  <div className="flex gap-2 px-4">
                    <Button
                      onClick={editorProps?.onCancel}
                      variant="outline"
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      onClick={editorProps?.onSave}
                      disabled={editorProps?.isSaving}
                      variant="success"
                      className="flex-1"
                    >
                      {editorProps?.isSaving ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      {editorProps?.isSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        );
    }
  };

  return (
    <>
      {/* Backdrop/Overlay - prevents clicks from going through to page behind, behind header */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
          onClick={onClose} // Click outside to close
          aria-label="Close drawer"
        />
      )}

      {/* Expandable Drawer - expands upward from bottom toolbar with rounded top corners */}
      <div
        className={cn(
          "md:hidden fixed left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-l border-r border-border shadow-lg transition-all duration-300 ease-in-out overflow-hidden",
          "bottom-20 rounded-t-xl", // Always positioned above bottom nav (80px) with rounded top corners
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"
        )}
        style={{
          transformOrigin: 'bottom', // Expand from bottom
        }}
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside drawer from closing it
      >
        {/* Visual connection indicator */}
        {isOpen && (
          <div className="absolute -bottom-1 left-4 w-8 h-2 bg-background/95 rounded-t-md border-l border-r border-t border-border" />
        )}

        {/* Content */}
        <div className="flex flex-col">
          {/* Account info at top */}
          {user && (
            <div className="p-4 border-b border-border bg-background/50">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={handleLogoutClick}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-foreground truncate">
                      {sanitizeUsername(user.username, 'Loading...', 'User')}
                    </div>
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Grid of navigation items */}
          <div className="p-4">
            {renderSection()}
          </div>
        </div>
      </div>

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
  )
}

// Default export for backward compatibility
export default MobileOverflowSidebar;