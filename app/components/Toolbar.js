"use client";

import { useContext } from "react";
import { Menu, Plus, Bell, User, Shuffle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../providers/AuthProvider";
import { DrawerContext } from "../providers/DrawerProvider";
import NotificationBadge from "./NotificationBadge";
import { useTheme } from "next-themes";
import { getRandomPage } from "../utils/randomPage";

/**
 * Toolbar Component
 *
 * A bottom toolbar that appears on the home page with a menu button,
 * plus button for creating new pages, and other navigation options.
 */
export default function Toolbar() {
  console.log("Toolbar component rendering");
  const router = useRouter();
  const { user } = useContext(AuthContext);

  // Get the DrawerContext directly
  const drawerContext = useContext(DrawerContext);
  const { theme } = useTheme();

  // Make sure we have access to the context
  if (!drawerContext) {
    console.error("DrawerContext is not available in Toolbar component");
  }

  const isLightMode = theme === 'light';

  const handleMenuClick = () => {
    console.log("Menu button clicked in Toolbar");

    // Ensure we have the drawer context
    if (!drawerContext) {
      console.error("DrawerContext is not available in Toolbar component");
      return;
    }

    console.log("DrawerContext:", drawerContext);

    try {
      // Directly access the setIsOpen function from the context
      drawerContext.setIsOpen(true);
      console.log("drawerContext.setIsOpen(true) called successfully");
    } catch (error) {
      console.error("Error opening drawer:", error);
    }
  };

  const handlePlusClick = () => {
    router.push("/new");
  };

  const handleNotificationsClick = () => {
    router.push("/notifications");
  };

  const handleRandomClick = async () => {
    try {
      const randomPageId = await getRandomPage();
      if (randomPageId) {
        router.push(`/${randomPageId}`);
      }
    } catch (error) {
      console.error("Error navigating to random page:", error);
    }
  };

  const handleSearchClick = () => {
    router.push("/search");
  };

  return (
    <>
      {/* Desktop Menu Button */}
      <div className="fixed left-4 top-4 z-50 hidden md:block">
        <button
          onClick={handleMenuClick}
          className="flex items-center justify-center p-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Menu"
          data-testid="desktop-menu-button"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile Toolbar */}
      <div
        id="toolbar"
        className={`fixed bottom-0 left-0 right-0 h-16 ${isLightMode ? 'bg-white text-black' : 'bg-primary text-white'} flex md:hidden items-center justify-between px-4 z-[2147483647] shadow-lg`}
      >
        <div className="flex items-center gap-6">
          <button
            onClick={handleMenuClick}
            className="flex flex-col items-center justify-center"
            aria-label="Menu"
            data-testid="mobile-menu-button"
          >
            <Menu className="h-6 w-6" />
            <span className="text-xs mt-1">Menu</span>
          </button>

          <button
            onClick={handleSearchClick}
            className="flex flex-col items-center justify-center"
            aria-label="Search"
          >
            <Search className="h-6 w-6" />
            <span className="text-xs mt-1">Search</span>
          </button>

          {user && (
            <>
              <button
                onClick={handleNotificationsClick}
                className="flex flex-col items-center justify-center relative"
                aria-label="Notifications"
              >
                <Bell className="h-6 w-6" />
                <NotificationBadge className="absolute -top-1 -right-1" />
                <span className="text-xs mt-1">Alerts</span>
              </button>

              <button
                onClick={handleRandomClick}
                className="flex flex-col items-center justify-center"
                aria-label="Random Page"
              >
                <Shuffle className="h-6 w-6" />
                <span className="text-xs mt-1">Random</span>
              </button>
            </>
          )}
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 -top-5">
          <button
            onClick={handlePlusClick}
            className={`${isLightMode ? 'bg-primary text-white' : 'bg-white text-primary'} h-14 w-14 rounded-full flex items-center justify-center shadow-lg`}
            aria-label="Create new page"
          >
            <Plus className="h-8 w-8" />
          </button>
        </div>

        <div className="flex items-center gap-6">
          {!user ? (
            <>
              <button
                onClick={() => router.push("/auth/login")}
                className="flex flex-col items-center justify-center"
                aria-label="Sign in"
              >
                <span className="text-xs mt-1">Sign in</span>
              </button>
              <button
                onClick={() => router.push("/auth/signup")}
                className="flex flex-col items-center justify-center"
                aria-label="Sign up"
              >
                <span className="text-xs mt-1">Sign up</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push(`/user/${user.uid}`)}
              className="flex flex-col items-center justify-center"
              aria-label="Profile"
            >
              <User className="h-6 w-6" />
              <span className="text-xs mt-1">Profile</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
