"use client";

import * as React from "react";
import { useTheme } from "../../providers/ThemeProvider";
// Removed @radix-ui/themes import - using simple radio buttons instead
import { Moon, Sun, Laptop, User } from "lucide-react";
import Link from "next/link";
import Modal from "../ui/modal";

interface ThemeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ThemeModal({ open, onOpenChange }: ThemeModalProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Theme"
      className="fixed top-[72px] right-4 w-[200px] rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60"
      showCloseButton={false}
    >
      <div className="space-y-2">
        <div className="space-y-2">
          <button
            className={`flex items-center space-x-3 cursor-pointer hover:bg-accent rounded-md p-1.5 w-full text-left ${theme === 'light' ? 'bg-accent' : ''}`}
            onClick={() => {
              setTheme('light');
              onOpenChange(false);
            }}
          >
            <div className={`w-3 h-3 rounded-full border-2 ${theme === 'light' ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
            <Sun className="h-4 w-4" />
            <span className="text-sm">Light</span>
          </button>
          <button
            className={`flex items-center space-x-3 cursor-pointer hover:bg-accent rounded-md p-1.5 w-full text-left ${theme === 'dark' ? 'bg-accent' : ''}`}
            onClick={() => {
              setTheme('dark');
              onOpenChange(false);
            }}
          >
            <div className={`w-3 h-3 rounded-full border-2 ${theme === 'dark' ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
            <Moon className="h-4 w-4" />
            <span className="text-sm">Dark</span>
          </button>
          <button
            className={`flex items-center space-x-3 cursor-pointer hover:bg-accent rounded-md p-1.5 w-full text-left ${theme === 'system' ? 'bg-accent' : ''}`}
            onClick={() => {
              setTheme('system');
              onOpenChange(false);
            }}
          >
            <div className={`w-3 h-3 rounded-full border-2 ${theme === 'system' ? 'border-primary bg-primary' : 'border-muted-foreground'}`} />
            <Laptop className="h-4 w-4" />
            <span className="text-sm">System</span>
          </button>
        </div>

        <Link href="/settings" className="flex items-center space-x-3 cursor-pointer hover:bg-accent rounded-md p-1.5 mt-4">
          <User className="h-4 w-4" />
          <span className="text-sm">Account Settings</span>
        </Link>
      </div>
    </Modal>
  );
}