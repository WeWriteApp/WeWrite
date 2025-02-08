"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import SubscriptionNotice from "./SubscriptionNotice";
import ThemeSwitcher from "./ThemeSwitcher";

const navItems = [
  { name: "Home", href: "/pages", icon: "carbon:home" },
  { name: "New page", href: "/new-page", icon: "carbon:document-add" },
  { name: "Search", href: "/search", icon: "carbon:search" },
  { name: "History", href: "/history", icon: "carbon:reset" },
  { name: "Profile", href: "/profile", icon: "carbon:user" },
  { name: "Activity", href: "/activity", icon: "carbon:fire" },
  { name: "Top up", href: "/top-up", icon: "carbon:wallet" },
  { name: "Settings", href: "/settings", icon: "carbon:settings" },
];

const DashboardSidebar = ({
  isSidebarOpen,
  setIsSidebarOpen,
}) => {
  // Toggle sidebar visibility
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Keyboard shortcut: Cmd + K (Mac) / Ctrl + K (Windows)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative bg-background text-text">
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute top-0 left-0 bg-background p-2 rounded-lg shadow-md hover:bg-gray-300 transition"
      >
        <Icon icon="carbon:menu" className="text-gray-700 text-md" />
      </button>

      <img src="/white.svg" alt="Logo" className="w-12 h-12 mx-auto mt-4 mb-8" />

      {/* Sidebar */}
      <div
        className={`h-screen bg-background  text-text flex flex-col justify-between p-4 shadow-sm transition-all duration-300
        ${isSidebarOpen ? "w-72" : "w-0 overflow-hidden"}`}
      >
        {/* Navigation Links */}
        <div className={`${isSidebarOpen ? "opacity-100" : "opacity-0 hidden"} transition-opacity`}>
          {navItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              className="flex items-center p-3 rounded-lg transition-all duration-200 hover:bg-gray-100 hover:border hover:border-blue-500 hover:text-gray-900"
            >
              <Icon icon={item.icon} className="text-gray-600 text-lg mr-3" />
              {isSidebarOpen && item.name}
            </Link>
          ))}
        </div>

        {/* Theme Switcher */}
        <ThemeSwitcher />
        {/* Subscription Notice Component */}
        {isSidebarOpen && <SubscriptionNotice />}

        {/* Account Section */}
        {isSidebarOpen && (
          <Link
            href="/account"
            className="flex items-center p-3 rounded-lg transition-all duration-200 hover:bg-gray-100 hover:border hover:border-blue-500 hover:text-gray-900"
          >
            <Icon icon="carbon:user-avatar" className="text-gray-600 text-lg mr-3" />
            My Account
          </Link>
        )}
      </div>
    </div>
  );
};

export default DashboardSidebar;