"use client";
import { useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { AuthContext } from "../providers/AuthProvider";
import { useTheme } from "../providers/ThemeProvider";
import ThemeSwitcher from "./ThemeSwitcher";

export default function Header() {
  const { theme } = useTheme();
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();

  return (
    <header
      className="fixed top-0 left-0 w-full bg-background shadow-lg px-4 py-3 flex items-center justify-between border-b-2 border-glow"
      style={{ zIndex: 10 }}
      data-theme={theme}
    >
      {/* Left Section - Logo */}
      <div className="flex items-center space-x-4">
        <Link href="/" className="flex items-center space-x-2">
          {/* logo is white.svg */}
          <img src="/white.svg" alt="logo" className="h-8 w-8" />
          <span className="text-xl font-semibold hidden md:inline text-glow">WeWrite</span>
        </Link>
      </div>

      {/* Center Section - Product Demo Navigation */}
      <nav className="hidden md:flex space-x-6 text-lg font-medium text-bright">
        <Link href="/demo" className="hover:text-primary transition border-b-2 border-transparent hover:border-glow">Product Demo</Link>
        <Link href="/features" className="hover:text-primary transition border-b-2 border-transparent hover:border-glow">Why WeWrite?</Link>
        <Link href="/pricing" className="hover:text-primary transition border-b-2 border-transparent hover:border-glow">How It Works</Link>
      </nav>

      {/* Right Section - User Actions */}
      <div className="flex items-center space-x-4">
        <ThemeSwitcher />
        {loading ? (
          <Icon icon="akar-icons:loading" className="h-6 w-6 animate-spin text-glow" />
        ) : user ? (
          <button
            onClick={() => router.push("/pages")}
            className="px-4 py-2 border rounded-lg border-glow hover:bg-gray-300 transition text-bright"
          >
            Your Pages
          </button>
        ) : (
          <Link
            href="/auth/login"
            className="px-4 py-2 border rounded-lg border-glow hover:bg-gray-300 transition text-bright"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
