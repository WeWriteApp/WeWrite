"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Laptop, Check } from "lucide-react";
import { Modal } from "./ui/modal";
import { AccentColorSwitcher } from "./AccentColorSwitcher";
import PillStyleToggle from "./PillStyleToggle";

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppearanceModal({ isOpen, onClose }: AppearanceModalProps) {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4 mr-2" /> },
    { value: "dark", label: "Dark", icon: <Moon className="h-4 w-4 mr-2" /> },
    { value: "system", label: "System", icon: <Laptop className="h-4 w-4 mr-2" /> },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Appearance"
      className="w-full max-w-md"
    >
      <div className="space-y-6">
        {/* Theme Options */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Theme</h3>
          <div className="space-y-1.5">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className={`flex items-center justify-between w-full px-3 py-2.5 text-sm rounded-md transition-colors
                  hover:bg-muted ${theme === option.value ? "bg-muted" : ""}`}
              >
                <div className="flex items-center">
                  {option.icon}
                  {option.label}
                </div>
                {theme === option.value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color Switcher */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Accent Color</h3>
          <AccentColorSwitcher />
        </div>

        {/* Pill Style Toggle */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Pill Style</h3>
          <PillStyleToggle />
        </div>
      </div>
    </Modal>
  );
}
