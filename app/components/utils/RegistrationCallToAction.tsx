"use client";

import React from 'react';
import { Button } from "../ui/button";
import Link from 'next/link';

/**
 * RegistrationCallToAction Component
 *
 * A call-to-action component that encourages user registration.
 * Replaces the "under construction" message for logged-out users.
 *
 * Features:
 * - Responsive layout (horizontal on desktop, vertical on mobile)
 * - Two action buttons: "Learn more" and "Sign up"
 * - Consistent design with rounded-2xl corners and proper spacing
 * - Uses established button components and design patterns
 */
const RegistrationCallToAction: React.FC = () => {
  return (
    <div
      data-registration-cta
      className="fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300"
    >
      <div className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-2xl border border-border/40 p-3">
        {/* Desktop Layout: Horizontal */}
        <div className="hidden sm:flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-foreground">
              Want to start writing on WeWrite?
            </h3>
          </div>
          <div className="flex gap-2">
            <Button
              size="default"
              variant="outline"
              asChild
              className="h-10"
            >
              <Link href="/">
                Learn more
              </Link>
            </Button>
            <Button
              size="default"
              asChild
              className="h-10"
              style={{ backgroundColor: '#1768FF', color: 'white' }}
            >
              <Link href="/auth/register">
                Sign up
              </Link>
            </Button>
          </div>
        </div>

        {/* Mobile Layout: Vertical */}
        <div className="sm:hidden space-y-3">
          <div className="text-center">
            <h3 className="text-sm font-medium text-foreground">
              Want to start writing on WeWrite?
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              size="default"
              asChild
              className="w-full h-10"
              style={{ backgroundColor: '#1768FF', color: 'white' }}
            >
              <Link href="/auth/register">
                Sign up
              </Link>
            </Button>
            <Button
              size="default"
              variant="outline"
              asChild
              className="w-full h-10"
            >
              <Link href="/">
                Learn more
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationCallToAction;
