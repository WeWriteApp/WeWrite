"use client";

import { ReactNode } from "react";
import { Image } from "../ui/image";
import Link from "next/link";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface ModernAuthLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  showLogo?: boolean;
  showTerms?: boolean;
}

export function ModernAuthLayout({
  children,
  title,
  description,
  showLogo = true,
  showTerms = true
}: ModernAuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row overflow-auto">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 bg-background">
        <div className="w-full max-w-md mx-auto">
          {/* Back to landing page link */}
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to landing page
          </Link>

          <motion.div
            className="wewrite-card rounded-xl shadow-sm border border-border p-6 md:p-8"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94] // Professional easing curve
            }}
          >
            {children}
          </motion.div>

          {/* Terms and privacy policy below the card */}
          {showTerms && (
            <div className="text-xs text-muted-foreground text-center mt-6">
              By using WeWrite you agree to our{' '}
              <Link
                href="https://github.com/WeWriteApp/WeWrite/blob/main/docs/TERMS_OF_SERVICE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link
                href="https://github.com/WeWriteApp/WeWrite/blob/main/docs/PRIVACY_POLICY.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Privacy Policy
              </Link>
            </div>
          )}
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