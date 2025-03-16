"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "../providers/ThemeProvider";
import { useClickOutside } from "../hooks/useClickOutside";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, () => setShowMenu(false));

  const getIcon = () => {
    switch (theme) {
      case "dark":
        return <Moon className="h-4 w-4" />;
      case "light":
        return <Sun className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="rounded-full p-2 hover:bg-accent text-foreground hover:text-accent-foreground transition-all duration-300"
        onClick={() => setShowMenu(!showMenu)}
        aria-label="Toggle theme"
      >
        {getIcon()}
      </button>

      {showMenu && (
        <div className="absolute top-full right-0 mt-2 p-2 bg-popover border border-border rounded-lg shadow-lg min-w-[150px] z-50">
          <button
            onClick={() => {
              setTheme("light");
              setShowMenu(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-md text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${
              theme === "light" ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
          <button
            onClick={() => {
              setTheme("dark");
              setShowMenu(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-md text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${
              theme === "dark" ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
          <button
            onClick={() => {
              setTheme("system");
              setShowMenu(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-md text-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${
              theme === "system" ? "bg-accent text-accent-foreground" : ""
            }`}
          >
            <Monitor className="h-4 w-4" />
            System
          </button>
        </div>
      )}
    </div>
  );
} 