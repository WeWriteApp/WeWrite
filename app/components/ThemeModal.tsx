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
      <Dialog.Content className="max-w-sm">
        <Dialog.Title>Choose Theme</Dialog.Title>
        <div className="py-4">
          <RadioGroup.Root
            value={theme}
            onValueChange={(value) => {
              setTheme(value);
              onOpenChange(false);
            }}
          >
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <RadioGroup.Item value="light" />
                <Sun className="h-4 w-4" />
                <span>Light</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <RadioGroup.Item value="dark" />
                <Moon className="h-4 w-4" />
                <span>Dark</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <RadioGroup.Item value="system" />
                <Laptop className="h-4 w-4" />
                <span>System</span>
              </label>
            </div>
          </RadioGroup.Root>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
} 