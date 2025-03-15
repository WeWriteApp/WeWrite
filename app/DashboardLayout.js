"use client";

import React, { useState, useContext } from "react";
import Sidebar from "./components/Sidebar";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Loader } from "./components/Loader";
import { useTheme } from "./providers/ThemeProvider";
import { DataContext } from "./providers/DataProvider";
import { MobileContext } from "./providers/MobileProvider";

const DashboardLayout = ({ children }) => {
  const { theme } = useTheme();
  const { loading } = useContext(DataContext);
  const { isMobile } = useContext(MobileContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header with menu button */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-16 bg-background border-b border-gray-200 z-30 px-4 flex items-center">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-150"
          >
            <Icon icon="ph:list" className="text-2xl" />
          </button>
          <div className="ml-4 flex items-center space-x-2">
            <Icon icon="ph:scribble-loop" className="text-2xl" />
            <span className="text-xl font-semibold">WeWrite</span>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main content */}
        <main className="flex-1 transition-all duration-150 ease-in-out">
          <div className="container mx-auto p-4 md:p-8">
            <Loader show={loading} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;