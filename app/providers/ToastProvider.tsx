"use client";

import { Toaster } from 'sonner';
import { ReactNode } from 'react';

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--background)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            padding: '12px 16px',
          },
          className: 'font-sans',
          duration: 4000,
        }}
        // Set the container z-index to ensure it's above all elements including headers
        className="z-[9999]"
      />
    </>
  );
}
