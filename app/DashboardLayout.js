"use client";

import { Loader } from "./components/Loader";
import { useTheme } from "./providers/ThemeProvider";
import { useContext } from "react";
import { DataContext } from "./providers/DataProvider";

export default function DashboardLayout({ children }) {
  const { theme } = useTheme();
  const { loading } = useContext(DataContext);
  
  return (
    <div className="flex flex-col bg-background min-h-screen pb-40" data-theme={theme}>
      <Loader show={loading} />
      <div className="flex-1">{children}</div>
    </div>
  );
}