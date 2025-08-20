"use client";

import { useTheme } from "../../providers/ThemeProvider";
import { useState, useEffect } from "react";
import PWABanner from '../utils/PWABanner';

export default function PublicLayout({ children }) {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-background" data-theme={theme || "system"}>
      <PWABanner />
      <div className="flex flex-col relative">
        {children}
      </div>
    </div>
  );
}