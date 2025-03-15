"use client";
import React, { useEffect, useContext } from "react";
import { MobileContext } from "../providers/MobileProvider";
import { Icon } from "@iconify/react/dist/iconify.js";
import { NavContext } from "../providers/NavProvider";
import Link from "next/link";
import { usePathname } from 'next/navigation';

const menuItems = [
  { name: 'Home', icon: 'ph:house-fill', href: '/' },
  { name: 'New page', icon: 'ph:file-plus-fill', href: '/new' },
  { name: 'Search', icon: 'ph:magnifying-glass-fill', href: '/search' },
  { name: 'Profile', icon: 'ph:user-fill', href: '/profile' },
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
  const pathname = usePathname();

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
        fixed top-0 left-0 h-full bg-background w-64 z-50 transform transition-transform duration-300 ease-in-out
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
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
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

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="bg-gray-900 text-white p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Icon icon="ph:warning" />
              <span className="font-semibold">Inactive</span>
            </div>
            <p className="text-sm mt-2">
              To start supporting writers, you must activate your subscription
            </p>
            <button className="w-full mt-4 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
              Activate
            </button>
          </div>
        </div>
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
