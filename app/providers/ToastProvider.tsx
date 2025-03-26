"use client";

import { Toaster } from 'sonner';
import { ReactNode } from 'react';

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--background)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            zIndex: 9999, // Ensure toast is above all elements
          },
          className: 'font-sans',
        }}
        // Set the container z-index to ensure it's above all elements including headers
        className="z-[9999]"
      />
    </>
  );
}
