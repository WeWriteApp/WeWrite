"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "../ui/button";
import { Github, Twitter, Instagram, Mail } from "lucide-react";
import { useTheme } from "next-themes";

// Landing page components
import { Hero } from "./Hero";
import { FeatureSection } from "./FeatureSection";
import { FaqSection } from "./FaqSection";
import { DeveloperSection } from "./DeveloperSection";

export default function LandingPage() {
  const router = useRouter();
  const { setTheme } = useTheme();
  
  // Force dark mode for landing page
  useEffect(() => {
    setTheme("dark");
  }, [setTheme]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6 md:gap-10">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-bold text-xl">WeWrite</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex gap-4">
              <Link href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="text-white hover:text-white/80">
                  <Github className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="https://twitter.com/your-account" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="text-white hover:text-white/80">
                  <Twitter className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="https://instagram.com/your-account" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="text-white hover:text-white/80">
                  <Instagram className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="mailto:contact@example.com" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="text-white hover:text-white/80">
                  <Mail className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            <Link href="/auth/login">
              <Button variant="outline" className="text-white border-white/20 hover:bg-white/10">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Hero />
        <FeatureSection />
        <FaqSection />
        <DeveloperSection />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-black py-6">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/60">© WeWrite, {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="https://tiktok.com" className="text-sm text-blue-500 hover:underline">TikTok</Link>
            <Link href="https://youtube.com" className="text-sm text-blue-500 hover:underline">YouTube</Link>
            <Link href="https://instagram.com" className="text-sm text-blue-500 hover:underline">Instagram</Link>
            <Link href="mailto:contact@example.com" className="text-sm text-blue-500 hover:underline">Email</Link>
          </div>
          <div className="md:hidden flex gap-4">
            <Link href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="text-white hover:text-white/80">
                <Github className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="https://twitter.com/your-account" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="text-white hover:text-white/80">
                <Twitter className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="https://instagram.com/your-account" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="text-white hover:text-white/80">
                <Instagram className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="mailto:contact@example.com" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="text-white hover:text-white/80">
                <Mail className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
