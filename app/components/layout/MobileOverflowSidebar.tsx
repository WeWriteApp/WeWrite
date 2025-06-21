"use client"

import * as React from "react"
import { useState, useEffect, useContext } from "react"
import { X, ChevronLeft, Palette, Settings, Check, User, Users, Shield, Globe, Lock, Link as LinkIcon, Trash2, Clock, Shuffle } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "../../firebase/config"
import { signOut } from "firebase/auth"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { useTheme } from "next-themes"
import { AccountSwitcher } from "../auth/AccountSwitcher"
import { AccentColorSwitcher } from "../utils/AccentColorSwitcher"
import PillStyleToggle from "../utils/PillStyleToggle"

import { AuthContext } from "../../providers/AuthProvider"
import { useFeatureFlag } from "../../utils/feature-flags"
import MapEditor from "../editor/MapEditor"
import { navigateToRandomPage, RandomPageFilters } from "../../utils/randomPageNavigation"
import RandomPageFilterMenu from "../ui/RandomPageFilterMenu"

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
  const { theme, setTheme } = useTheme()
  const [currentSection, setCurrentSection] = useState<string | null>(null)
  const [isRandomMenuOpen, setIsRandomMenuOpen] = useState(false)
  const { user } = useContext(AuthContext)

  // Groups feature is now always enabled for all users
  const groupsEnabled = true;

  // Check if map feature is enabled
  const mapFeatureEnabled = useFeatureFlag('map_view', user?.email);

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

  const themeOptions = [
    {
      value: "light",
      label: "Light",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-5 w-5 text-foreground"
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      )
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-5 w-5 text-foreground"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      )
    },
    {
      value: "system",
      label: "System",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-5 w-5 text-foreground"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      )
    }
  ]

  // Render the appropriate section based on currentSection
  const renderSection = () => {
    switch (currentSection) {
      case 'appearance':
        return (
          <div className="animate-in slide-in-from-right-4 duration-300 ease-out">
            <div className="flex items-center mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={goBackToMain}
                className="mr-2 hover:bg-neutral-alpha-2 dark:hover:bg-muted"
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h3 className="text-lg font-semibold">Appearance</h3>
            </div>

            <div className="flex flex-col space-y-4">
              {/* Theme Options */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Theme</h3>
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors mb-1",
                      "hover:bg-muted",
                      theme === option.value && "bg-muted"
                    )}
                  >
                    <div className="flex items-center">
                      {option.icon}
                      {option.label}
                    </div>
                    {theme === option.value && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>

              {/* Accent Color Switcher */}
              <AccentColorSwitcher />

              {/* Pill Style Toggle */}
              <PillStyleToggle />
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col space-y-6 animate-in fade-in-50 duration-300 ease-out">
            {/* Account Switcher */}
            <div className="mb-2">
              <AccountSwitcher />
            </div>

            {/* Main Menu Items */}
            <div className="space-y-1">
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
                    await navigateToRandomPage(router, user?.uid);
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

              {/* Groups navigation item - now always visible for all users */}
              <button
                onClick={() => {
                  console.log('[DEBUG] Sidebar - Groups button clicked, navigating to /groups');
                  // Close the sidebar first
                  onClose();
                  // Use window.location for more reliable navigation
                  window.location.href = '/groups';
                }}
                className="flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted"
              >
                <Users className="h-5 w-5 mr-2" />
                <span>Groups</span>
              </button>

              <button
                onClick={() => navigateToSection('appearance')}
                className="flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted"
              >
                <Palette className="h-5 w-5 mr-2" />
                <span>Appearance</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  router.push('/settings');
                }}
                className="flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted"
              >
                <Settings className="h-5 w-5 mr-2" />
                <span>Settings</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  router.push(`/user/${user?.uid}`);
                }}
                className="flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted"
              >
                <User className="h-5 w-5 mr-2" />
                <span>Profile</span>
              </button>

              {/* Admin Dashboard - Only visible for admins */}
              {user && user.email && isAdmin(user.email) && (
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

                  {/* Public/Private visibility switcher */}
                  <div
                    className="flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors hover:bg-neutral-alpha-2 dark:hover:bg-muted cursor-pointer"
                    onClick={() => editorProps?.setIsPublic?.(!editorProps?.isPublic)}
                  >
                    <div className="flex items-center">
                      {editorProps?.isPublic ? (
                        <Globe className="h-5 w-5 mr-2 text-green-500" />
                      ) : (
                        <Lock className="h-5 w-5 mr-2 text-muted-foreground" />
                      )}
                      <span>{editorProps?.isPublic ? "Public" : "Private"}</span>
                    </div>
                    <Switch
                      checked={editorProps?.isPublic || false}
                      onCheckedChange={editorProps?.setIsPublic}
                      aria-label="Toggle page visibility"
                    />
                  </div>

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

          {renderSection()}
        </div>
      </div>
    </>
  )
}

// Default export for backward compatibility
export default MobileOverflowSidebar;