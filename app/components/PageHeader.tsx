"use client";

import * as React from "react";
import { useTheme } from "../providers/ThemeProvider";
import { ChevronLeftIcon, DotsVerticalIcon, Share2Icon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/DropdownMenu";

interface PageHeaderProps {
  title: string;
  username: string;
  userGroups?: { id: string; name: string }[];
  currentGroupId?: string | null;
  onGroupChange?: (groupId: string | null) => void;
  isPublic?: boolean;
  onPrivacyChange?: (isPublic: boolean) => void;
}

export function PageHeader({
  title,
  username,
  userGroups = [],
  currentGroupId = null,
  onGroupChange,
  isPublic = false,
  onPrivacyChange,
}: PageHeaderProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const [showBylineMenu, setShowBylineMenu] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [scrollPercentage, setScrollPercentage] = React.useState(0);
  const [showPledgeBar, setShowPledgeBar] = React.useState(true);
  const lastScrollY = React.useRef(0);

  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percentage = Math.min(100, Math.round((currentScrollY / scrollHeight) * 100));
      
      // Update scroll percentage
      setScrollPercentage(percentage);
      
      // Update collapsed state
      setIsCollapsed(currentScrollY > 100);

      // Handle pledge bar visibility
      if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setShowPledgeBar(false);
      } else {
        // Scrolling up
        setShowPledgeBar(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/* Pledge bar */}
      <div
        className={cn(
          "bg-primary/10 text-primary-foreground h-12 flex items-center justify-center transition-transform duration-300",
          !showPledgeBar && "-translate-y-full"
        )}
      >
        Support this page
      </div>

      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between w-full px-4 py-2 border-b bg-background/80 backdrop-blur-md transition-all duration-300",
          isCollapsed ? "h-14" : "h-20"
        )}
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/pages")}
            className={cn(
              "rounded-full transition-opacity duration-300",
              isCollapsed && "opacity-0 pointer-events-none"
            )}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          
          <div className="flex flex-col">
            <h1 className={cn(
              "font-semibold transition-all duration-300",
              isCollapsed ? "text-base" : "text-xl"
            )}>
              {title}
            </h1>
            <button
              onClick={() => setShowBylineMenu(true)}
              className="flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              {currentGroupId ? `in ${userGroups.find(g => g.id === currentGroupId)?.name}` : `by ${username}`}
            </button>

            {showBylineMenu && (
              <div className="absolute mt-8 p-4 bg-background border rounded-lg shadow-lg">
                <div className="space-y-2">
                  <label className="block font-medium">Myself:</label>
                  <button
                    onClick={() => {
                      onGroupChange?.(null);
                      setShowBylineMenu(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md",
                      !currentGroupId && "bg-accent"
                    )}
                  >
                    by {username}
                  </button>

                  {userGroups.length > 0 && (
                    <>
                      <label className="block font-medium mt-4">My groups:</label>
                      <div className="space-y-1">
                        {userGroups.map((group) => (
                          <button
                            key={group.id}
                            onClick={() => {
                              onGroupChange?.(group.id);
                              setShowBylineMenu(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md",
                              currentGroupId === group.id && "bg-accent"
                            )}
                          >
                            in {group.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Scroll percentage */}
          <div className={cn(
            "text-sm text-muted-foreground transition-opacity duration-300",
            !isCollapsed && "opacity-0"
          )}>
            {scrollPercentage}%
          </div>

          {/* Actions */}
          <div className={cn(
            "flex items-center gap-2 transition-opacity duration-300",
            isCollapsed && "opacity-0 pointer-events-none"
          )}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Share2Icon className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <DotsVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onPrivacyChange?.(!isPublic)}>
                  Make {isPublic ? "private" : "public"}
                </DropdownMenuItem>
                <DropdownMenuItem>Add to page...</DropdownMenuItem>
                <DropdownMenuItem>Themes</DropdownMenuItem>
                <DropdownMenuItem>Line modes</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  Delete page
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
} 