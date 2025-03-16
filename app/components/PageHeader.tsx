"use client";

import { useTheme } from "@/providers/ThemeProvider";
import { ChevronLeftIcon, DotsVerticalIcon, Share2Icon } from "@radix-ui/react-icons";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

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
  const [showBylineMenu, setShowBylineMenu] = useState(false);

  return (
    <div className="flex items-center justify-between w-full px-4 py-2 border-b">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/pages")}
          className="rounded-full"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold">{title}</h1>
          <button
            onClick={() => setShowBylineMenu(true)}
            className="flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            by {username} {currentGroupId && "in group"}
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

      <div className="flex items-center gap-2">
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
  );
} 