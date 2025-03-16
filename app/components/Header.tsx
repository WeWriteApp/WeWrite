"use client";

import * as React from "react";
import { LogOut, Moon } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { auth } from "../firebase/config";
import { signOut as firebaseSignOut } from "firebase/auth";
import Link from "next/link";
import Button from "./Button";
import ThemeModal from "./ThemeModal";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [themeModalOpen, setThemeModalOpen] = React.useState(false);
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
            <div className="flex items-center flex-1">
              <Link href="/" className="mr-6 flex items-center space-x-2">
                <span className="font-bold">WeWrite</span>
              </Link>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/new">
                <Button variant="secondary" size="sm">
                  New page
                </Button>
              </Link>
              {user && (
                <>
                  <Link href={`/user/${user.uid}`}>
                    <Button variant="ghost" size="sm">
                      Profile
                    </Button>
                  </Link>
                  <Button variant="secondary" size="sm" onClick={handleLogout}>
                    Log out
                  </Button>
                </>
              )}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setThemeModalOpen(true)}
                className="h-9 w-9"
              >
                <Moon className="h-[1.2rem] w-[1.2rem]" />
              </Button>
            </div>
          </div>
          {/* Scroll Progress Bar */}
          <div 
            className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-200"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>
      <div className="h-20" /> {/* Spacer for fixed header */}
      <ThemeModal open={themeModalOpen} onOpenChange={setThemeModalOpen} />
    </>
  );
} 