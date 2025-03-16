"use client";

import * as React from "react";
import { ChevronLeft, Moon } from 'lucide-react';
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "./Button";
import ThemeModal from "./ThemeModal";

export interface PageHeaderProps {
  title?: string;
  username?: string;
  userId?: string;
  isLoading?: boolean;
}

export default function PageHeader({ title, username, userId, isLoading = false }: PageHeaderProps) {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [themeModalOpen, setThemeModalOpen] = React.useState(false);

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

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full">
        <div className={`relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200 ${isScrolled ? "h-14" : "h-20"}`}>
          <div className={`container flex items-center h-full px-6 transition-all duration-200`}>
            <div className="flex items-center flex-1 min-w-0 space-x-6">
              <Link href="/">
                <Button variant="secondary" size="sm" className="shrink-0">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className={`font-semibold truncate transition-all ${isScrolled ? "text-base" : "text-xl"}`}>
                  {isLoading ? (
                    <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
                  ) : (
                    title || "Untitled"
                  )}
                </h1>
                <p className={`text-muted-foreground truncate transition-all mt-1 ${isScrolled ? "text-sm" : "text-base"}`}>
                  by{" "}
                  {isLoading ? (
                    <div className="inline-block h-4 w-24 bg-muted animate-pulse rounded"></div>
                  ) : userId ? (
                    <Link href={`/user/${userId}`} className="hover:underline">
                      {username || "[NULL]"}
                    </Link>
                  ) : (
                    <span>{username || "[NULL]"}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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