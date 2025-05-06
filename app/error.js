"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "./components/ui/button";
import { Home, ArrowLeft, RefreshCw } from "lucide-react";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full bg-card p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
        <p className="text-lg text-muted-foreground mb-8">
          We're sorry, but there was an error loading this page.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="gap-2 w-full sm:w-auto"
            onClick={() => reset()}
          >
            <RefreshCw className="h-5 w-5" />
            Try again
          </Button>
          <Button asChild size="lg" className="gap-2 w-full sm:w-auto">
            <Link href="/">
              <Home className="h-5 w-5" />
              Back to Home
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2 w-full sm:w-auto"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
