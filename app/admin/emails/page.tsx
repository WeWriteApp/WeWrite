"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect from old /admin/emails route to new /admin/notifications route
 */
export default function AdminEmailsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/notifications');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Redirecting to notifications...</p>
    </div>
  );
}
