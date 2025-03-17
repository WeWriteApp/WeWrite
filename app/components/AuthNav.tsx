"use client";

import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";
import Button from "./Button";
import { Menu } from "lucide-react";
import { Sidebar } from "./ui/sidebar";
import { useState } from "react";

export default function AuthNav() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {user ? (
        // User is logged in - show sidebar toggle
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-accent text-foreground"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      ) : (
        // User is not logged in - show login button
        <div className="flex items-center">
          <Link href="/auth/login">
            <Button
              variant="outline"
              size="sm"
              className="hover:bg-primary/90 hover:text-primary-foreground"
            >
              Start writing
            </Button>
          </Link>
        </div>
      )}

      {/* Sidebar for logged-in users */}
      {user && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
} 