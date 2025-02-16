"use client";

import { Loader } from "./components/Loader";
import { useTheme } from "./providers/ThemeProvider";
export default function DashboardLayout({ children }) {
  const { theme } = useTheme();
  return (
    <div className="flex flex-col bg-background min-h-screen pb-40" data-theme={theme}>
      <Loader />
      <div className="flex-1">{children}</div>
    </div>
  );
}