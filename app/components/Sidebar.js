"use client";
import React, { useEffect, useContext } from "react";
import { MobileContext } from "../providers/MobileProvider";
import { Icon } from "@iconify/react/dist/iconify.js";
import { NavContext } from "../providers/NavProvider";
import Link from "next/link";
import { AuthContext } from "../providers/AuthProvider";

const Sidebar = () => {
  const { isMobile } = useContext(MobileContext);
  const { user } = useContext(AuthContext);

  let tabs = [
    {
      name: "Dashboard",
      icon: "bx:bx-home",
      href: "/",
    },
  ];
  
  // Add subscription link if user is logged in
  if (user) {
    tabs.push({
      name: "Subscription",
      icon: "bx:bx-credit-card",
      href: "/account/subscription",
    });
  }

  if (tabs.length === 0) {
    return "loading...";
  }
  return (
    <div
      className={`flex flex-col h-full bg-background ${
        !isMobile ? "w-64" : "w-0"
      } overflow-hidden -mt-4`}
    >
      <div className="flex items-center justify-center p-4">
        <Link
          href="/new"
          className="bg-primary flex flex-row w-full text-center justify-center align-middle p-2"
        >
          <p className="text-white">New Page</p>
        </Link>
      </div>
      <div className="flex flex-col p-4">
        {tabs.map((tab, index) => (
          <SidebarItem key={index} icon={tab.icon} text={tab.name} href={tab.href} />
        ))}
      </div>
    </div>
  );
};

const SidebarItem = ({ icon, text, href }) => {
  const { setSelectedTab, selectedTab } = useContext(NavContext);

  return (
    <Link
      href={href || "/"}
      onClick={() => setSelectedTab(text)}
      className={`flex flex-row items-center space-x-2 p-2 text-sm cursor-pointer ${
        selectedTab === text ? "bg-sidebar/20" : "hover:bg-sidebar/10"
      } rounded`}
    >
      <Icon icon={icon} width="20" height="20" />
      <span>{text}</span>
    </Link>
  );
};

export default Sidebar;
