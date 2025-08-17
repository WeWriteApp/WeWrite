"use client";

import { Inter } from "next/font/google";
import FullPageError from "./components/ui/FullPageError";

const inter = Inter({ subsets: ["latin"] });

// Type definitions
interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

interface ErrorDetails {
  message: string;
  stack: string;
  timestamp: string;
  userAgent: string;
  url: string;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <FullPageError
          error={error}
          reset={reset}
          title="Critical Error"
          message="We're sorry, but there was a critical error loading the application."
          showGoBack={false}
        />
      </body>
    </html>
  );
}