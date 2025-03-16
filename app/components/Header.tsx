"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border h-12">
        <div className="flex items-center justify-between h-full px-4">
          <h1 className="font-semibold text-foreground text-lg">WeWrite</h1>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="rounded-full p-2 hover:bg-accent text-foreground hover:text-accent-foreground transition-all duration-300"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      {/* Spacer to prevent content from being hidden under the header */}
      <div className="h-12" />
    </>
  );
} 