"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Dialog, RadioGroup } from "@radix-ui/themes";
import { Moon, Sun, Laptop } from "lucide-react";

interface ThemeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ThemeModal({ open, onOpenChange }: ThemeModalProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="fixed top-[72px] right-4 w-[200px] rounded-lg border bg-background/95 p-4 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Dialog.Title className="text-sm font-medium mb-3">Choose Theme</Dialog.Title>
        <div className="space-y-2">
          <RadioGroup.Root
            value={theme}
            onValueChange={(value) => {
              setTheme(value);
              onOpenChange(false);
            }}
          >
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer hover:bg-accent rounded-md p-1.5">
                <RadioGroup.Item value="light" />
                <Sun className="h-4 w-4" />
                <span className="text-sm">Light</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer hover:bg-accent rounded-md p-1.5">
                <RadioGroup.Item value="dark" />
                <Moon className="h-4 w-4" />
                <span className="text-sm">Dark</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer hover:bg-accent rounded-md p-1.5">
                <RadioGroup.Item value="system" />
                <Laptop className="h-4 w-4" />
                <span className="text-sm">System</span>
              </label>
            </div>
          </RadioGroup.Root>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
} 