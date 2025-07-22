"use client";

import { useTheme } from "../../providers/ThemeProvider";
import { useState, useEffect } from "react";

export default function PublicLayout({ children }) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ensure hydration consistency
  useEffect(() => {
    setMounted(true);
  }, []);

  // Use a consistent theme value during SSR and hydration
  const safeTheme = mounted ? theme : "system";

  return (
    <div className="min-h-screen bg-background" data-theme={safeTheme}>
      <div className="flex flex-col relative">
        {children}
      </div>
    </div>
  );
}