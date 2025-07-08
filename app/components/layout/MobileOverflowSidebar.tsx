"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { X, ChevronLeft, Settings, Check, User, Users, Shield, Link as LinkIcon, Trash2, Clock, Shuffle, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
// Removed direct Firebase auth imports - using session management system
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { logoutUser } from "../../firebase/auth"

import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useFeatureFlag } from "../../utils/feature-flags"
import MapEditor from "../editor/MapEditor"
import { navigateToRandomPage, RandomPageFilters } from "../../utils/randomPageNavigation"
import RandomPageFilterMenu from "../ui/RandomPageFilterMenu"
import { WarningDot } from '../ui/warning-dot';
import { StatusIcon } from '../ui/status-icon';
import { useSubscriptionWarning } from '../../hooks/useSubscriptionWarning';
import { useBankSetupStatus } from '../../hooks/useBankSetupStatus';
import { useUserEarnings } from '../../hooks/useUserEarnings';

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
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

export function MobileOverflowSidebar({ isOpen, onClose, editorProps }: SidebarProps) {
  const router = useRouter()
  const [currentSection, setCurrentSection] = useState<string | null>(null)
  const [isRandomMenuOpen, setIsRandomMenuOpen] = useState(false)
  const { session } = useCurrentAccount();
  const { shouldShowWarning: shouldShowSubscriptionWarning, warningVariant, hasActiveSubscription, paymentsEnabled } = useSubscriptionWarning();
  const bankSetupStatus = useBankSetupStatus();
  const { earnings } = useUserEarnings();

  // Calculate the most critical status from all settings sections (same logic as UnifiedSidebar)
  const getMostCriticalSettingsStatus = () => {
    if (!paymentsEnabled) return null;

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

  // Check if map feature is enabled
  const mapFeatureEnabled = useFeatureFlag('map_view', session?.email);

  // Determine if we're in edit mode
  const isEditMode = !!(editorProps?.onSave && editorProps?.onCancel);

  // Check if user is admin
  const isAdmin = (userEmail?: string | null): boolean => {
    if (!userEmail) return false;
    return userEmail === 'jamiegray2234@gmail.com';
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

  // Function to navigate to a section
  const navigateToSection = (section: string) => {
    setCurrentSection(section)
  }

  // Function to go back to main menu
  const goBackToMain = () => {
    setCurrentSection(null)
  }

  // Render the appropriate section based on currentSection
  const renderSection = () => {
    switch (currentSection) {

      default:
        return (
          <div className="flex flex-col h-full">
            {/* Main Menu Items */}
            <div className="space-y-1 mb-6">
              <button
                onClick={() => {
                  onClose();
                  router.push('/recents');
                }}
                className="flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted"
              >
                <Clock className="h-5 w-5 mr-2" />
                <span>Recents</span>
              </button>

              <div className="relative group">
                <button
                  onClick={async () => {
                    onClose();
                    await navigateToRandomPage(router, session?.uid);
                  }}
                  className="flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted"
                >
                  <Shuffle className="h-5 w-5 mr-2" />
                  <span>Random Page</span>
                </button>

                {/* Random Page Filter Menu */}
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <RandomPageFilterMenu
                    size="sm"
                    onFiltersChange={(filters: RandomPageFilters) => {
                      // Filters are automatically persisted by the component
                    }}
                    onOpenChange={(isOpen) => {
                      setIsRandomMenuOpen(isOpen);
                    }}
                  />
                </div>
              </div>

              {/* Groups functionality removed */}

              <button
                onClick={() => {
                  onClose();
                  router.push('/settings');
                }}
                className="flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted"
              >
                <div className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  <span>Settings</span>
                </div>
                {criticalSettingsStatus === 'warning' && (
                  <StatusIcon
                    status="warning"
                    size="sm"
                    position="static"
                  />
                )}
              </button>

              <button
                onClick={() => {
                  onClose();
                  router.push(`/user/${session?.uid}`);
                }}
                className="flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted"
              >
                <User className="h-5 w-5 mr-2" />
                <span>Profile</span>
              </button>

              {/* Admin Dashboard - Only visible for admins */}
              {session && session.email && isAdmin(session.email) && (
                <button
                  onClick={() => {
                    onClose();
                    router.push('/admin');
                  }}
                  className="flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted"
                >
                  <Shield className="h-5 w-5 mr-2" />
                  <span>Admin Dashboard</span>
                </button>
              )}
            </div>

            {/* Editor Functions (only show in edit mode) */}
            {isEditMode && (
              <>
                <div className="border-t border-border my-4" />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground px-2">Editor</h3>



                  {/* Insert Link button removed - editing controls should only be in editing contexts */}

                  {/* Location button - only show if map feature is enabled */}
                  {mapFeatureEnabled && (
                    <div className="px-3">
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
                      className="flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="h-5 w-5 mr-2" />
                      <span>Delete</span>
                    </button>
                  )}

                  {/* Cancel and Save buttons */}
                  <div className="flex gap-2 px-3">
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
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
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
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-[999] transition-opacity duration-300 min-h-screen w-screen",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => {
          // Don't close if the random menu is open
          if (!isRandomMenuOpen) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-background border-r border-border z-[1000] transition-transform duration-300 ease-in-out shadow-lg h-[100vh] overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">WeWrite</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-neutral-alpha-2 dark:hover:bg-muted"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Main content area - flex-1 to take remaining space */}
          <div className="flex-1 flex flex-col">
            {renderSection()}
          </div>

          {/* User info and logout at bottom */}
          {session && (
            <div className="mt-auto pt-4 border-t border-border">
              {/* User Information */}
              <div className="mb-3 px-3 py-2">
                <div className="text-sm font-medium text-foreground truncate">
                  {session.displayName || session.username || 'User'}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {session.email}
                </div>
              </div>

              {/* Logout Button */}
              <Button
                variant="ghost"
                onClick={() => logoutUser()}
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <LogOut className="h-5 w-5 mr-2" />
                Log Out
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Default export for backward compatibility
export default MobileOverflowSidebar;