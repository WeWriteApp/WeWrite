"use client";

import { ReactNode, useEffect } from "react";
import Footer from "./Footer";
import Link from "next/link";
import Image from "next/image";
import { GradientBlobBackground } from "./GradientBlobBackground";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  // Prevent body scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 flex w-full">
      {/* Left side - scrollable with gradient background */}
      <div className="w-full lg:w-1/2 overflow-y-auto relative">
        {/* Deep navy blue background from image 1 */}
        <div className="absolute inset-0 bg-[#0a0a4d]/95 z-0"></div>
        
        {/* Gradient blob background */}
        <GradientBlobBackground className="z-10" />
        
        <div className="flex flex-col min-h-full p-6 md:p-10 relative z-20">
          {/* Header */}
          <div className="flex justify-center gap-2 md:justify-start">
            <Link href="/" className="flex items-center gap-2 font-medium text-white">
              WeWrite
            </Link>
          </div>
          
          {/* Main Content */}
          <div className="flex-1 flex items-center justify-center py-10">
            <div className="w-full max-w-xs">
              {children}
            </div>
          </div>
          
          {/* Footer in the left column - extended to full width */}
          <div className="mt-auto -mx-6 md:-mx-10">
            <Footer className="border-t border-white/10 text-white/90" />
          </div>
        </div>
      </div>
      
      {/* Right Side - Image with Enhanced Particle Overlay */}
      <div className="fixed top-0 right-0 bottom-0 hidden lg:block w-1/2">
        <Image
          src="/images/auth-image.png"
          alt="WeWrite App on a smartphone"
          fill
          priority
          className="object-cover object-center"
        />
        {/* Removed the blur from the overlay */}
        <div className="absolute inset-0 bg-black/20"></div>
        {/* Removed ParticleOverlay */}
      </div>
    </div>
  );
}
