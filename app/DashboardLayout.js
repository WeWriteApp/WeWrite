"use client";

import { useState } from "react";
import { Loader } from "./components/Loader";
import { useTheme } from "./providers/ThemeProvider";
import DashboardSidebar from "./components/DashboardSidebar";

export default function DashboardLayout({ children }) {
  const { theme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-white text-black" data-theme={theme}>
      {/* Sidebar */}
      <DashboardSidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

      {/* Main Content */}
      <div
        className={`flex flex-col flex-1 min-h-screen transition-all duration-300 ${
          isSidebarOpen ? "ml-0" : "ml-0"
        } pb-40 overflow-auto bg-gray-50`}
      >
        <Loader />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}