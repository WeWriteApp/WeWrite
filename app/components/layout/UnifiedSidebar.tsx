"use client";

import React, { useState, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import {
  Home, Search, User, Settings, ChevronLeft, ChevronRight, Bell, Plus,
  Globe, Lock, Link as LinkIcon, X, Check, Trash2, MapPin, Palette, Shield,
  Sun, Moon, Laptop, ArrowLeft, Clock, Shuffle
} from "lucide-react";
import { useAuth } from "../../providers/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useFeatureFlag } from "../../utils/feature-flags";
import { useTheme } from "next-themes";
import { navigateToRandomPage, RandomPageFilters } from "../../utils/randomPageNavigation";
import MapEditor from "../editor/MapEditor";
import RandomPageFilterMenu from "../ui/RandomPageFilterMenu";
import { AccountSwitcher } from "../auth/AccountSwitcher";
import AccentColorSwitcher from "../utils/AccentColorSwitcher";
import PillStyleToggle from "../utils/PillStyleToggle";
import { cn } from "../../lib/utils";

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
  isPublic?: boolean;
  setIsPublic?: (value: boolean) => void;
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
  const [isRandomMenuOpen, setIsRandomMenuOpen] = useState(false);

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
      {/* Only render sidebar for authenticated users */}
      {isMounted && user && <UnifiedSidebarContent isExpanded={isExpanded} setIsExpanded={setIsExpanded} isHovering={isHovering} setIsHovering={setIsHovering} toggleExpanded={toggleExpanded} isRandomMenuOpen={isRandomMenuOpen} setIsRandomMenuOpen={setIsRandomMenuOpen} />}
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
  const [isRandomMenuOpen, setIsRandomMenuOpen] = useState(false);

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

  return <UnifiedSidebarContent isExpanded={isExpanded} setIsExpanded={setIsExpanded} isHovering={isHovering} setIsHovering={setIsHovering} toggleExpanded={toggleExpanded} isRandomMenuOpen={isRandomMenuOpen} setIsRandomMenuOpen={setIsRandomMenuOpen} />;
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
  toggleExpanded,
  isRandomMenuOpen,
  setIsRandomMenuOpen
}: {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  isHovering: boolean;
  setIsHovering: (value: boolean) => void;
  toggleExpanded: () => void;
  isRandomMenuOpen: boolean;
  setIsRandomMenuOpen: (value: boolean) => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const editorContext = useContext(EditorContext);
  const { theme, setTheme } = useTheme();

  // Appearance settings state
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false);

  // Check if map feature is enabled
  const mapFeatureEnabled = useFeatureFlag('map_view', user?.email);

  // Check if user is admin
  const isAdmin = user?.email === 'jamiegray2234@gmail.com';

  // Determine if we're in edit mode (editor functions are available)
  const isEditMode = !!(editorContext.onSave && editorContext.onCancel);



  // Determine if sidebar should show content (expanded or hovering)
  const showContent = isExpanded || isHovering;

  // Navigation items
  // Build navigation items based on user state
  const navItems = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Search, label: 'Search', href: '/search' },
    { icon: Shuffle, label: 'Random Page', action: () => navigateToRandomPage(router, user?.uid) },
    { icon: Clock, label: 'Recents', href: '/recents' },
    { icon: Plus, label: 'New Page', href: '/new' },
    { icon: Bell, label: 'Notifications', href: '/notifications' },
    { icon: User, label: 'Profile', href: user ? `/user/${user.uid}` : '/login' },
    { icon: Settings, label: 'Settings', href: '/settings' },
    { icon: Palette, label: 'Appearance', action: () => setShowAppearanceSettings(true) },
    // Admin Dashboard - only for admin users
    ...(isAdmin ? [{ icon: Shield, label: 'Admin Dashboard', href: '/admin' }] : []),
  ];

  // Check if navigation item is active
  const isNavItemActive = (item: any) => {
    if (!item.href) return false;

    // Exact match for most routes
    if (pathname === item.href) return true;

    // Special case for profile - match user profile pages
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

  // Theme options for appearance settings
  const themeOptions = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4 mr-2" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4 mr-2" /> },
    { value: "system", label: "System", icon: <Laptop className="h-4 w-4 mr-2" /> },
  ];



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
      onMouseLeave={() => {
        // Don't collapse if the random page menu is open
        if (!isRandomMenuOpen) {
          setIsHovering(false);
        }
      }}
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
              const isRandomPage = item.label === 'Random Page';
              const isActive = isNavItemActive(item);

              return (
                <div key={item.href || index} className={cn("relative", isRandomPage && "group")}>
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
                      "sidebar-icon-container",
                      showContent && "mr-3"
                    )}>
                      <Icon className="h-5 w-5 flex-shrink-0" />
                    </div>

                    {/* Text label - slides in from the right */}
                    <div className={cn(
                      "sidebar-text-container flex-1 flex items-center",
                      showContent ? "opacity-100 max-w-none" : "opacity-0 max-w-0"
                    )}>
                      <span className="font-medium whitespace-nowrap text-left">
                        {item.label}
                      </span>
                    </div>
                  </Button>

                  {/* Random Page Filter Menu - only show when expanded and for random page item */}
                  {isRandomPage && showContent && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <RandomPageFilterMenu
                        size="sm"
                        onFiltersChange={(filters) => {
                          // Update the navigation action with new filters
                          const updatedItem = { ...item, action: () => navigateToRandomPage(router, user?.uid, filters) };
                          // The filters are already persisted by the component, so we don't need to do anything else
                        }}
                        onOpenChange={(isOpen) => {
                          setIsRandomMenuOpen(isOpen);
                          // If menu is closed and we're in hover mode, allow collapse
                          if (!isOpen && isHovering && !isExpanded) {
                            setIsHovering(false);
                          }
                        }}
                      />
                    </div>
                  )}
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
                {/* Public/Private visibility switcher */}
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border border-input cursor-pointer hover:bg-primary/10 transition-colors duration-300",
                    !showContent && "justify-center"
                  )}
                  onClick={() => editorContext.setIsPublic?.(!editorContext.isPublic)}
                  title={showContent ? "" : (editorContext.isPublic ? "Public" : "Private")}
                >
                  {editorContext.isPublic ? (
                    <Globe className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  {showContent && (
                    <>
                      <span className="text-sm font-medium flex-1 transition-opacity duration-200">
                        {editorContext.isPublic ? "Public" : "Private"}
                      </span>
                      <Switch
                        checked={editorContext.isPublic || false}
                        onCheckedChange={editorContext.setIsPublic}
                        aria-label="Toggle page visibility"
                      />
                    </>
                  )}
                </div>

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
                      variant="default"
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

          {/* Appearance Settings Panel */}
          {showAppearanceSettings && showContent && !isEditMode && (
            <div className="absolute inset-0 bg-background border-r border-border z-10 flex flex-col">
              {/* Appearance Settings Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAppearanceSettings(false)}
                    className="h-8 w-8"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-lg font-semibold">Appearance</h3>
                </div>
              </div>

              {/* Appearance Settings Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Theme Options */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Theme</h4>
                    <div className="space-y-1">
                      {themeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value)}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors",
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
                  </div>

                  {/* Accent Color Switcher */}
                  <AccentColorSwitcher />

                  {/* Pill Style Toggle */}
                  <PillStyleToggle />
                </div>
              </div>
            </div>
          )}

          {/* Account Switcher - sticky at bottom for non-edit mode */}
          {!isEditMode && (
            <div className="mt-auto pt-4 border-t border-border">
              {showContent ? (
                <AccountSwitcher />
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    // If we're in a temporary hover state, end it before navigation
                    if (isHovering && !isExpanded) {
                      setIsHovering(false);
                    }
                    router.push('/settings');
                  }}
                  className={cn(
                    "relative flex items-center h-12 w-full text-foreground hover:bg-primary/10 hover:text-primary transition-all duration-300 sidebar-nav-button",
                    showContent && "sidebar-nav-button-expanded",
                    // Active state styling consistent with other nav items
                    pathname === '/settings' && "bg-primary/10 text-primary"
                  )}
                  title="Settings"
                >
                  {/* Icon container - maintains position during transitions */}
                  <div className="sidebar-icon-container">
                    <Settings className="h-5 w-5 flex-shrink-0" />
                  </div>
                </Button>
              )}
            </div>
          )}
        </div>
    </div>
  );

  // Use portal to render sidebar at document root level
  return createPortal(sidebarContent, document.body);
}
