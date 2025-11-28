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
  // Safely handle the error object to prevent "frame.join is not a function" errors
  let safeError: Error;
  try {
    const messageSource = (error as any)?.message ?? (error as any)?.reason?.message;
    const stackSource = (error as any)?.stack ?? (error as any)?.reason?.stack;

    const rawMessage =
      typeof messageSource === 'string'
        ? messageSource
        : Array.isArray(messageSource)
          ? messageSource.join('\n')
          : String(messageSource || 'Unknown error occurred');

    const rawStack =
      typeof stackSource === 'string'
        ? stackSource
        : Array.isArray(stackSource)
          ? stackSource.join('\n')
          : stackSource
            ? JSON.stringify(stackSource, null, 2)
            : 'No stack trace available';

    // Ensure we have a proper Error object
    safeError = {
      name: (error as any)?.name || 'Error',
      message: rawMessage,
      stack: rawStack,
      digest: (error as any)?.digest
    } as Error & { digest?: string };
  } catch (e) {
    // Fallback if error processing fails
    safeError = new Error('Critical error occurred during error processing');
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <FullPageError
          error={safeError}
          reset={reset}
          title="Critical Error"
          message="We're sorry, but there was a critical error loading the application."
          showGoBack={false}
        />
      </body>
    </html>
  );
}
