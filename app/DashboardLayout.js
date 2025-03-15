"use client";

import React, { useState, useContext } from "react";
import Sidebar from "./components/Sidebar";
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