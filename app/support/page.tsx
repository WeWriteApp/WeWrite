"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SupportRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/subscription');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-muted-foreground">Redirecting to subscription page...</p>
    </div>
  );

}