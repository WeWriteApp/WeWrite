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
        console.log('Fetching random page from API');

        // Add a cache-busting parameter to avoid caching issues
        const timestamp = new Date().getTime();
        const response = await fetch(`/api/random-page?t=${timestamp}`, {
          // Add cache control headers
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API response not OK:', response.status, errorData);
          throw new Error(errorData.error || 'Failed to fetch random page');
        }

        const data = await response.json();
        console.log('Random page data received:', data);

        if (data.pageId) {
          console.log(`Navigating to random page: /${data.pageId}`);
          // Navigate to the random page using window.location for more reliable navigation
          window.location.href = `/${data.pageId}`;

          // Prefetch the next random page in the background
          // This will help ensure the cache is always filled
          setTimeout(() => {
            fetch(`/api/random-page?prefetch=true&t=${Date.now()}`, {
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            }).catch(err => console.log('Background prefetch error:', err));
          }, 1000);
        } else {
          console.error('No pageId in response:', data);
          setError('No pages found');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching random page:', error);
        setError(error.message || 'Failed to fetch random page');
        setIsLoading(false);

        // Add a fallback - if we can't get a random page, go to the home page after 3 seconds
        setTimeout(() => {
          console.log('Fallback: Redirecting to home page');
          window.location.href = '/';
        }, 3000);
      }
    };

    fetchRandomPage();
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <div className="bg-background border border-border rounded-lg p-8 shadow-sm max-w-md w-full text-center">
          <div className="text-amber-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
              <path d="M12 9v4"></path>
              <path d="M12 17h.01"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Error Finding Random Page</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <p className="text-sm text-muted-foreground mb-6">Redirecting to home page in 3 seconds...</p>
          <button
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md"
            onClick={() => router.push('/')}
          >
            Go Home Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <div className="bg-background border border-border rounded-lg p-8 shadow-sm max-w-md w-full text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-6 mx-auto" />
        <h2 className="text-xl font-medium mb-2">Finding a Random Page</h2>
        <p className="text-muted-foreground">Exploring the WeWrite universe for something interesting...</p>
      </div>
    </div>
  );
}
