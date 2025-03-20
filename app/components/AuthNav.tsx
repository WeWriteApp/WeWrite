"use client";

import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";
import Button from "./Button";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useState } from "react";

export default function AuthNav() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {user && (
        // User is logged in - show sidebar toggle
        <div className="flex items-center">
          <Button
            onClick={() => setSidebarOpen(true)}
            variant="ghost"
            size="icon"
            aria-label="Menu"
            className="mr-2"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </div>
      )}
    </>
  );
} 