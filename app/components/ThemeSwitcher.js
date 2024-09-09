"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "../providers/ThemeProvider";
import { Tooltip } from "react-tooltip";

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  return (
    <>
      <Tooltip
        place="bottom"
        type="dark"
        effect="solid"
        anchorSelect="#theme-switcher"
        content={
          theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"
        }
        />
      <button
        onClick={toggleTheme}
        className="text-primary p-2 rounded-full hover:bg-primary hover:text-background"
        id="theme-switcher"
      >
        {theme === "light" ? "🌞" : "🌙"}
      </button>
    </>
  );
}
