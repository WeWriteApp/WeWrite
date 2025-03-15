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

  const handleLogout = async () => {
    await logoutUser();
    router.push('/auth/login');
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
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full bg-background w-64 z-50 transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:z-0
      `}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <Link href="/" className="flex items-center space-x-2">
            <Icon icon="ph:scribble-loop" className="text-2xl" />
            <span className="text-xl font-semibold">WeWrite</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 flex-grow">
          {updatedMenuItems.map((item) => (
            <Link
              key={item.name}
              href={item.comingSoon ? '#' : item.href}
              className={`
                flex items-center space-x-3 p-2 rounded-lg w-full
                ${pathname === item.href ? 'bg-primary text-white' : 'hover:bg-gray-100'}
                ${item.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={item.comingSoon ? (e) => e.preventDefault() : undefined}
            >
              <Icon icon={item.icon} className="text-xl" />
              <span>{item.name}</span>
              {item.comingSoon && (
                <span className="ml-auto text-xs bg-gray-200 px-2 py-1 rounded">
                  Coming soon!
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User menu */}
        {user && (
          <div className="border-t border-gray-200 p-4">
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100"
              >
                <div className="flex items-center space-x-2 flex-grow">
                  {user.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt={user.username || "User"}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <Icon icon="ph:user-circle-fill" className="text-2xl" />
                  )}
                  <span>{user.username}</span>
                </div>
                <Icon 
                  icon={isUserMenuOpen ? "ph:caret-up-bold" : "ph:caret-down-bold"} 
                  className="text-xl"
                />
              </button>

              {/* User menu dropdown */}
              {isUserMenuOpen && (
                <div className="absolute bottom-full left-0 w-full bg-background border border-gray-200 rounded-lg shadow-lg mb-2">
                  <Link
                    href={`/user/${user.uid}`}
                    className="flex items-center space-x-2 p-3 hover:bg-gray-100 rounded-t-lg"
                  >
                    <Icon icon="ph:user" className="text-xl" />
                    <span>View profile</span>
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center space-x-2 p-3 hover:bg-gray-100"
                  >
                    <Icon icon="ph:gear" className="text-xl" />
                    <span>Account settings</span>
                  </Link>
                  <Link
                    href="#"
                    className="flex items-center space-x-2 p-3 hover:bg-gray-100"
                  >
                    <Icon icon="ph:arrows-left-right" className="text-xl" />
                    <span>Switch account</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 p-3 hover:bg-gray-100 w-full text-left text-red-500 rounded-b-lg"
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
