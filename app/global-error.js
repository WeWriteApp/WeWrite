"use client";

import { Inter } from "next/font/google";
import { Button } from "./components/ui/button";
import { RefreshCw } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full bg-card p-8 rounded-lg shadow-lg text-center">
            <h1 className="text-4xl font-bold mb-4">Something went wrong</h1>
            <p className="text-lg text-muted-foreground mb-8">
              We're sorry, but there was a critical error loading the application.
            </p>
            <Button 
              size="lg" 
              className="gap-2 w-full sm:w-auto"
              onClick={() => reset()}
            >
              <RefreshCw className="h-5 w-5" />
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
