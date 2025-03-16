"use client";

import { Loader } from "./components/Loader";
import { useTheme } from "./providers/ThemeProvider";
import { useContext } from "react";
import { DataContext } from "./providers/DataProvider";

export default function DashboardLayout({ children }) {
  const { theme } = useTheme();
  const { loading } = useContext(DataContext);
  
  return (
    <div className="min-h-screen bg-background" data-theme={theme}>
      <Loader show={loading} />
      <div className="flex flex-col">
        {children}
      </div>
    </div>
  );
}