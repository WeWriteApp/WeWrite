"use client";

import * as React from "react";
import { ChevronLeftIcon, DotsVerticalIcon, Share2Icon } from "@radix-ui/react-icons";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  author: string;
  group?: string;
  onBack?: () => void;
}

export function PageHeader({ title, author, group, onBack }: PageHeaderProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const viewportHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;
      
      // Calculate scroll percentage
      const scrollPercentage = (scrolled / (fullHeight - viewportHeight)) * 100;
      setScrollProgress(Math.min(scrollPercentage, 100));
      
      // Update header collapse state
      setIsCollapsed(scrolled > 64);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
      {/* Progress bar */}
      <div 
        className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-300"
        style={{ width: `${scrollProgress}%` }}
      />

      <div className="container mx-auto px-4">
        <div className={`flex items-center gap-4 transition-all duration-300 ${isCollapsed ? "h-16" : "h-20"}`}>
          {/* Back button */}
          <button
            onClick={onBack}
            className="rounded-full p-2 hover:bg-accent"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          {/* Title and author */}
          <div className="flex-1">
            <h1 className={`font-semibold transition-all duration-300 ${isCollapsed ? "text-base" : "text-xl"}`}>
              {title}
            </h1>
            <div className="text-sm text-muted-foreground">
              {group ? `in ${group}` : `by ${author}`}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="rounded-full p-2 hover:bg-accent">
              <Share2Icon className="h-4 w-4" />
            </button>
            <button className="rounded-full p-2 hover:bg-accent">
              <DotsVerticalIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
} 