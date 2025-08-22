"use client";

import { useTheme } from "../../providers/ThemeProvider";

export default function PublicLayout({ children }) {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-background" data-theme={theme || "system"}>
      <div className="flex flex-col relative">
        {children}
      </div>
    </div>
  );
}