"use client";

import * as React from "react";
import { Menu, Plus } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { auth } from "../firebase/config";
import { signOut as firebaseSignOut } from "firebase/auth";
import Link from "next/link";
import Button from "./Button";
import ThemeModal from "./ThemeModal";
import { Sidebar } from "./ui/sidebar";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [themeModalOpen, setThemeModalOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { user } = useAuth();

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
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full">
        <div className={`relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200 ${isScrolled ? "h-14" : "h-20"}`}>
          <div className={`container flex items-center h-full px-6 transition-all duration-200`}>
            {/* Mobile Menu Button (visible on mobile) */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo/Title (centered on mobile) */}
            <div className="flex-1 flex items-center justify-center md:justify-start">
              <Link href="/" className="flex items-center space-x-2">
                <span className="font-bold">WeWrite</span>
              </Link>
            </div>

            {/* Desktop Navigation (hidden on mobile) */}
            <div className="hidden md:flex items-center space-x-3">
              {user && (
                <Button variant="outline" size="sm" onClick={() => setSidebarOpen(true)}>
                  Menu
                </Button>
              )}
            </div>

            {/* New Page Button (blue on mobile) */}
            <Link href="/new">
              <Button
                variant="default"
                size="icon"
                className="md:hidden bg-blue-500 hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                size="sm"
                className="hidden md:inline-flex"
              >
                New page
              </Button>
            </Link>
          </div>
          {/* Scroll Progress Bar */}
          <div 
            className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>
      <div className="h-20" /> {/* Spacer for fixed header */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onThemeClick={() => {
          setSidebarOpen(false);
          setThemeModalOpen(true);
        }}
      />
      <ThemeModal open={themeModalOpen} onOpenChange={setThemeModalOpen} />
    </>
  );
} 