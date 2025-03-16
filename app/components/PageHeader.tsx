"use client";

import * as React from "react";
import { ChevronLeft, ChevronDown, Lock, Unlock, Moon, Sun, Link as LinkIcon, Globe, Check } from 'lucide-react';
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useClickOutside } from "../hooks/useClickOutside";
import { updatePage } from "../firebase/database";
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from 'next-themes';
import ThemeToggle from "./ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";

export interface PageHeaderProps {
  title: string;
  username: string;
  userGroups?: { id: string; name: string }[];
  currentGroupId?: string | null;
  onGroupChange?: (groupId: string | null) => void;
  isPublic?: boolean;
  onPrivacyChange?: (isPublic: boolean) => void;
  pageId?: string;
  showBackButton?: boolean;
}

export default function PageHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/">
            <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center space-x-2">
            <ThemeToggle />
            <UserMenu />
          </nav>
        </div>
      </div>
    </header>
  );
} 