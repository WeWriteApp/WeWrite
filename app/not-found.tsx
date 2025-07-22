"use client";

import Link from "next/link";
import { Button } from "./components/ui/button";
import { useEffect } from "react";

export default function NotFound() {
  // Add error logging to help debug the React error #185
  useEffect(() => {
    console.log('🔍 NotFound page mounted');

    // Log current URL and referrer for debugging
    if (typeof window !== 'undefined') {
      console.log('🔍 NotFound page details:', {
        url: window.location.href,
        referrer: document.referrer,
        timestamp: new Date().toISOString()
      });
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full bg-card p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Sorry, we couldn't find the page you're looking for.
        </p>
        <Button asChild size="lg">
          <Link href="/">
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
}