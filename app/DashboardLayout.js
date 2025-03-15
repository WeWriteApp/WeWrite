"use client";

import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Loader } from "./components/Loader";
import { useTheme } from "./providers/ThemeProvider";
import { useContext } from "react";
import { DataContext } from "./providers/DataProvider";

const DashboardLayout = ({ children }) => {
  const { theme } = useTheme();
  const { loading } = useContext(DataContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header with menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background border-b border-gray-200 z-30 px-4 flex items-center">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <Icon icon="ph:list" className="text-2xl" />
        </button>
        <div className="ml-4 flex items-center space-x-2">
          <Icon icon="ph:scribble-loop" className="text-2xl" />
          <span className="text-xl font-semibold">WeWrite</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex h-full">
        {/* Sidebar */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main content */}
        <main className="flex-1 lg:pl-64 pt-16 lg:pt-0">
          <div className="container mx-auto px-4 py-8">
            <Loader show={loading} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;