"use client";

import Link from "next/link";
import { useAuth } from "../providers/AuthProvider";
import { Button } from "./ui/button";
import { Menu } from "lucide-react";
import { useContext } from "react";
import { DrawerContext } from "../providers/DrawerProvider";
import NotificationDot from "./NotificationDot";

export default function AuthNav() {
  const { user, logout } = useAuth();
  const { setIsOpen: setDrawerOpen } = useContext(DrawerContext);

  return (
    <>
      {user && (
        // User is logged in - show sidebar toggle
        <div className="flex items-center">
          <div className="relative">
            <Button
              onClick={() => setDrawerOpen(true)}
              variant="outline"
              size="icon"
              aria-label="Menu"
              className="mr-2 transition-all duration-200"
            >
              <Menu className="h-5 w-5" />
              <NotificationDot className="top-1 right-1" />
            </Button>
          </div>

          {/* No longer rendering a separate Sidebar instance - using the global one */}
        </div>
      )}
    </>
  );
}