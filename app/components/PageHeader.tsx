"use client";

import * as React from "react";
import { ChevronLeft, Link2 } from 'lucide-react';
import Link from "next/link";
import Button from "./Button";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

export interface PageHeaderProps {
  title?: string;
  username?: string;
  userId?: string;
  isLoading?: boolean;
}

export default function PageHeader({ title, username, userId, isLoading = false }: PageHeaderProps) {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const pathname = usePathname();

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

  const handleCopyLink = () => {
    const url = `${window.location.origin}${pathname}`;
    navigator.clipboard.writeText(url).then(() => {
      toast("Copied page link");
    });
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full">
        <div className={`relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-200 ${isScrolled ? "h-10" : "h-20"}`}>
          <div className={`container flex items-center h-full px-6 transition-all duration-200 ${isScrolled ? "justify-between" : ""}`}>
            <div className={`flex items-center min-w-0 ${isScrolled ? "space-x-3" : "space-x-6 flex-1"}`}>
              <Link href="/">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="hover:bg-white/10 text-white h-8 w-8 shrink-0 transition-all duration-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className={`min-w-0 ${isScrolled ? "flex items-center space-x-2 py-1.5" : ""}`}>
                <h1 className={`font-semibold truncate transition-all ${isScrolled ? "text-sm" : "text-xl"}`}>
                  {isLoading ? (
                    <div className="h-6 w-48 bg-muted animate-pulse rounded"></div>
                  ) : (
                    title || "Untitled"
                  )}
                </h1>
                <p className={`text-muted-foreground truncate transition-all ${isScrolled ? "text-xs mt-0" : "text-base mt-1"}`}>
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
            {!isScrolled && (
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-white/10 text-white h-8 w-8 shrink-0 transition-all duration-200"
                onClick={handleCopyLink}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {/* Scroll Progress Bar */}
          <div 
            className="absolute bottom-0 left-0 h-0.5 bg-blue-500 transition-all duration-200"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>
      <div className="h-20" /> {/* Spacer for fixed header */}
    </>
  );
} 