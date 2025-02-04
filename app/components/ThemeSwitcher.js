"use client";
import React, { useState, useEffect } from "react";
import { useTheme } from "../providers/ThemeProvider";
import { Tooltip } from "react-tooltip";
import { Icon } from "@iconify/react";

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  return (
    <>
      <Tooltip
        place="bottom"
        type="dark"
        effect="solid"
        anchorSelect="#theme-switcher"
        content={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
      />
      <button
        onClick={toggleTheme}
        className="p-2 rounded-full transition duration-300 ease-in-out transform hover:scale-110 hover:bg-primary hover:text-background shadow-md shadow-glow"
        id="theme-switcher"
      >
        <Icon 
          icon={theme === "light" ? "ph:sun-bold" : "ph:moon-bold"} 
          className="text-2xl transition-colors duration-300 text-glow"
        />
      </button>
    </>
  );
}
