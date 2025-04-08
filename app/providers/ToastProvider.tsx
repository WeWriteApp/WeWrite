"use client";

import { Toaster } from 'sonner';
import { ReactNode } from 'react';

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--background)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          },
          className: 'font-sans',
          success: {
            style: {
              backgroundColor: 'var(--background)',
              borderColor: 'var(--primary)',
              borderLeftWidth: '4px',
            },
          },
          error: {
            style: {
              backgroundColor: 'var(--background)',
              borderColor: 'var(--destructive)',
              borderLeftWidth: '4px',
            },
          },
          info: {
            style: {
              backgroundColor: 'var(--background)',
              borderColor: 'var(--primary)',
              borderLeftWidth: '4px',
            },
          },
        }}
        // Set the container z-index to ensure it's above all elements including headers
        className="z-[9999]"
        richColors
      />
    </>
  );
}
