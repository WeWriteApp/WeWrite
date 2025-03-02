"use client";

import { useEffect, useState } from "react";
import { Loader } from "./components/Loader";
import { useTheme } from "./providers/ThemeProvider";
import DashboardSidebar from "./components/DashboardSidebar";
import { useAuth } from "./providers/AuthProvider";
import { useRouter } from "next/navigation";

export default function DashboardLayout({ children }) {
  const { theme } = useTheme();
  const {user, loading} = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const router = useRouter();
  useEffect(() => {
    if (!user && !loading) {
      // redirect to login
      router
        .push("/auth/login")

    }
  }, [user]);
  return (
    <div className="flex h-screen overflow-hidden bg-background text-text" data-theme={theme}>
      {/* Sidebar */}
      <DashboardSidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

      {/* Main Content */}
      <div
        className={`flex flex-col flex-1 min-h-screen transition-all duration-300 ${
          isSidebarOpen ? "ml-0" : "ml-0"
        } pb-40 overflow-auto bg-background`}
      >
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}