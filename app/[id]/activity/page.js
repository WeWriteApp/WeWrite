"use client";

import React, { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function PageActivityPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  // Redirect to the new versions route
  useEffect(() => {
    if (id) {
      router.replace(`/${id}/versions`);
    }
  }, [id, router]);

  // Return a loading state while redirecting
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-center">
          <div className="rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to page versions...</p>
        </div>
      </div>
    </div>
  );
}