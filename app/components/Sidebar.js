"use client";
import React, { useEffect, useContext } from "react";
import { MobileContext } from "../providers/MobileProvider";
import { Icon } from "@iconify/react/dist/iconify.js";
import { NavContext } from "../providers/NavProvider";
import Link from "next/link";

const Sidebar = () => {
  const { isMobile } = useContext(MobileContext);

  let tabs = [
    {
      name: "Dashboard",
      icon: "bx:bx-home",
    },
  ];

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
          <SidebarItem key={index} icon={tab.icon} text={tab.name} />
        ))}
      </div>
    </div>
  );
};

const SidebarItem = ({ icon, text }) => {
  const { setSelectedTab, selectedTab } = useContext(NavContext);

  return (
    <div
      onClick={() => setSelectedTab(text)}
      className={`flex flex-row items-center space-x-2 p-2 text-sm cursor-pointer ${
        selectedTab === text ? "bg-accent" : ""
      }`}
    >
      <Icon icon={icon} className="text-white" />
      <p className="text-white">{text}</p>
    </div>
  );
};

export default Sidebar;
