"use client";
import { useTheme } from "./providers/ThemeProvider";

export default function Home() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Welcome to WeWrite</h1>
        <button
          onClick={toggleTheme}
          className="px-4 py-2 rounded-md bg-primary text-button-text hover:bg-primary-hover transition-colors"
        >
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </button>
      </div>
      <p className="mt-2">Testing page content</p>
    </div>
  );
}
