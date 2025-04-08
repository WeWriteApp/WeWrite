"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RandomPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRandomPage = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/random-page');

        if (!response.ok) {
          throw new Error('Failed to fetch random page');
        }

        const data = await response.json();

        if (data.pageId) {
          // Navigate to the random page using window.location for more reliable navigation
          window.location.href = `/${data.pageId}`;
        } else {
          setError('No pages found');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching random page:', error);
        setError(error.message || 'Failed to fetch random page');
        setIsLoading(false);
      }
    };

    fetchRandomPage();
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          onClick={() => router.push('/')}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Finding a random page for you...</p>
    </div>
  );
}
