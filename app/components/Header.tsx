"use client";

import * as React from "react";
import { LogOut, Plus } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import ThemeToggle from "./ThemeToggle";
import { auth } from "../firebase/config";
import { signOut as firebaseSignOut } from "firebase/auth";
import Link from "next/link";
import Button from "./Button";
import { UserMenu } from "./ui/user-menu";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 0);

      // Calculate scroll progress
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const maxScroll = documentHeight - windowHeight;
      const progress = (scrollPosition / maxScroll) * 100;
      setScrollProgress(Math.min(progress, 100));
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth);
      router.push("/auth/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!isHomePage) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className={`relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200 ${isScrolled ? "h-14" : "h-20"}`}>
        <div className={`container flex items-center h-full transition-all duration-200`}>
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <span className="hidden font-bold sm:inline-block">WeWrite</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <Link href="/pages/new">
                <Button variant="secondary" size="sm" className="w-full md:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="flex items-center">Create Page</span>
                </Button>
              </Link>
            </div>
            <nav className="flex items-center space-x-2">
              <ThemeToggle />
              <UserMenu />
            </nav>
          </div>
        </div>
        {/* Scroll Progress Bar */}
        <div 
          className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
    </header>
  );
} 