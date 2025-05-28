"use client";

import { ReactNode, useEffect } from "react";
import { Image } from "./ui/image";
import Link from "next/link";
import { cn } from "../lib/utils";
import { motion } from "framer-motion";

interface ModernAuthLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  showLogo?: boolean;
}

export function ModernAuthLayout({
  children,
  title,
  description,
  showLogo = true
}: ModernAuthLayoutProps) {
  // Prevent body scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 bg-white dark:bg-gray-950">
        <div className="w-full max-w-md mx-auto">
          {/* Header removed as requested */}

          <motion.div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 md:p-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94] // Professional easing curve
            }}
          >
            {children}
          </motion.div>

          {/* Terms and privacy policy removed */}
        </div>
      </div>

      {/* Right side - Image and branding */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-blue-500 to-indigo-600 relative">
        <div className="absolute inset-0 bg-black/20 z-10"></div>
        <div className="relative z-20 flex flex-col items-center justify-center w-full p-12 text-white">
          <div className="max-w-md text-center">
            <h2 className="text-3xl font-bold mb-4">WeWrite</h2>
            <p className="text-lg mb-8">
              A social wiki where every page is a fundraiser. Write a hundred pages, you've just written a hundred Kickstarters.
            </p>
            <div className="flex justify-center space-x-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center">
                <div className="text-2xl font-bold">Simple</div>
                <div className="text-sm">Easy to use interface</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center">
                <div className="text-2xl font-bold">Creative</div>
                <div className="text-sm">Express your ideas</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center">
                <div className="text-2xl font-bold">Social</div>
                <div className="text-sm">Connect with writers</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
