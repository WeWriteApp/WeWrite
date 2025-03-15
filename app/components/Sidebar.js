"use client";
import React, { useEffect, useContext, useState } from "react";
import { MobileContext } from "../providers/MobileProvider";
import { Icon } from "@iconify/react/dist/iconify.js";
import { NavContext } from "../providers/NavProvider";
import { AuthContext } from "../providers/AuthProvider";
import Link from "next/link";
import { usePathname, useRouter } from 'next/navigation';
import Image from "next/image";
import { logoutUser } from "../firebase/auth";
import { useTheme } from "../providers/ThemeProvider";
import ReactGA from 'react-ga4';

const menuItems = [
  { name: 'Home', icon: 'ph:house-fill', href: '/' },
  { name: 'New page', icon: 'ph:file-plus-fill', href: '/new' },
  { name: 'Search', icon: 'ph:magnifying-glass-fill', href: '/search' },
  { name: 'Profile', icon: 'ph:user-fill', href: '/user' },
  { 
    name: 'Notifications', 
    icon: 'ph:bell-fill', 
    href: '/notifications',
    comingSoon: true 
  },
  { 
    name: 'Activity', 
    icon: 'ph:activity-fill', 
    href: '/activity',
    comingSoon: true 
  },
  { 
    name: 'History', 
    icon: 'ph:clock-clockwise-fill', 
    href: '/history',
    comingSoon: true 
  },
  { 
    name: 'Random page', 
    icon: 'ph:dice-five-fill', 
    href: '/random',
    comingSoon: true 
  },
  { 
    name: 'Daily notes', 
    icon: 'ph:notebook-fill', 
    href: '/daily',
    comingSoon: true 
  },
  { 
    name: 'Graph view', 
    icon: 'ph:graph-fill', 
    href: '/graph',
    comingSoon: true 
  },
  { 
    name: 'Top up', 
    icon: 'ph:currency-circle-dollar-fill', 
    href: '/topup',
    comingSoon: true 
  }
];

const Sidebar = ({ isOpen, onClose }) => {
  const { isMobile } = useContext(MobileContext);
  const { user } = useContext(AuthContext);
  const pathname = usePathname();
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logoutUser();
    router.push('/auth/login');
  };

  const handleNavigation = (item) => {
    ReactGA.event({
      category: 'Navigation',
      action: 'Click',
      label: item.name
    });
  };

  // Update profile link with user's ID
  const updatedMenuItems = menuItems.map(item => {
    if (item.name === 'Profile' && user) {
      return { ...item, href: `/user/${user.uid}` };
    }
    return item;
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Mobile menu trigger */}
      {isMobile && !isOpen && (
        <button
          onClick={() => onClose(false)}
          className="fixed top-4 left-4 p-2 bg-background rounded-lg shadow-lg z-40 hover:bg-gray-100 transition-colors duration-150"
        >
          <Icon icon="ph:list" className="text-2xl" />
        </button>
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-screen bg-background z-50 flex flex-col
        transition-all duration-150 ease-in-out
        ${isCollapsed ? 'w-16' : 'w-64'}
        ${isMobile ? `transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}` : ''}
        ${!isMobile ? 'relative translate-x-0 z-0' : ''}
      `}>
        {/* Logo and collapse button */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <Link href="/" className="flex items-center space-x-2">
            <Icon icon="ph:scribble-loop" className="text-2xl" />
            {!isCollapsed && <span className="text-xl font-semibold">WeWrite</span>}
          </Link>
          {!isMobile && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 hover:bg-gray-100 rounded transition-colors duration-150"
            >
              <Icon 
                icon={isCollapsed ? "ph:caret-right" : "ph:caret-left"} 
                className="text-xl"
              />
            </button>
          )}
        </div>

        {/* Navigation - Scrollable */}
        <nav className="p-4 space-y-2 flex-grow overflow-y-auto">
          {updatedMenuItems.map((item) => (
            <Link
              key={item.name}
              href={item.comingSoon ? item.href : item.href}
              className={`
                flex items-center space-x-3 p-2 rounded-lg w-full whitespace-nowrap
                transition-colors duration-150
                ${pathname === item.href ? 'bg-primary text-white' : 'hover:bg-gray-100'}
                ${item.comingSoon ? 'opacity-50' : ''}
              `}
              onClick={(e) => {
                handleNavigation(item);
              }}
            >
              <Icon icon={item.icon} className="text-xl shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="truncate">{item.name}</span>
                  {item.comingSoon && (
                    <span className="ml-auto text-xs bg-gray-200 px-2 py-1 rounded shrink-0">
                      Soon
                    </span>
                  )}
                </>
              )}
            </Link>
          ))}
        </nav>

        {/* User menu - Sticky to bottom */}
        {user && (
          <div className="border-t border-gray-200 p-4 shrink-0">
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-150"
              >
                <div className="flex items-center space-x-2 flex-grow min-w-0">
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt={user.username || "User"}
                      width={32}
                      height={32}
                      className="rounded-full shrink-0"
                    />
                  ) : (
                    <Icon icon="ph:user-circle-fill" className="text-2xl shrink-0" />
                  )}
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{user.username}</span>
                      <Icon 
                        icon={isUserMenuOpen ? "ph:caret-up-bold" : "ph:caret-down-bold"} 
                        className="text-xl shrink-0"
                      />
                    </>
                  )}
                </div>
              </button>

              {/* User menu dropdown */}
              {isUserMenuOpen && (
                <div className="absolute bottom-full left-0 w-full bg-background border border-gray-200 rounded-lg shadow-lg mb-2">
                  <Link
                    href={`/user/${user.uid}`}
                    className="flex items-center space-x-2 p-3 hover:bg-gray-100 rounded-t-lg transition-colors duration-150"
                  >
                    <Icon icon="ph:user" className="text-xl" />
                    <span>View profile</span>
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center space-x-2 p-3 hover:bg-gray-100 transition-colors duration-150"
                  >
                    <Icon icon="ph:gear" className="text-xl" />
                    <span>Account settings</span>
                  </Link>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center space-x-2 p-3 hover:bg-gray-100 w-full text-left transition-colors duration-150"
                  >
                    <Icon icon={theme === 'dark' ? "ph:sun" : "ph:moon"} className="text-xl" />
                    <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                  </button>
                  <Link
                    href="#"
                    className="flex items-center space-x-2 p-3 hover:bg-gray-100 transition-colors duration-150"
                  >
                    <Icon icon="ph:arrows-left-right" className="text-xl" />
                    <span>Switch account</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 p-3 hover:bg-gray-100 w-full text-left text-red-500 rounded-b-lg transition-colors duration-150"
                  >
                    <Icon icon="ph:sign-out" className="text-xl" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const SidebarItem = ({ icon, text }) => {
  const { setSelectedTab, selectedTab } = useContext(NavContext);

  return (
    <div
      onClick={() => setSelectedTab(text)}
      className={`flex flex-row items-center space-x-2 p-2 text-sm cursor-pointer ${
        selectedTab === text ? "bg-gray-700" : ""
      }`}
    >
      <Icon icon={icon} className="text-white" />
      <p className="text-white">{text}</p>
    </div>
  );
};

export default Sidebar;
