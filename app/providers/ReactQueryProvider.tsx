/**
 * React Query Provider for Firebase Cost Optimization
 * 
 * Provides optimized React Query configuration with aggressive caching
 * to minimize Firebase reads and maximize cost efficiency.
 */

'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { optimizedQueryClient } from '../utils/reactQueryConfig';

// Dynamically import devtools to avoid build issues
const ReactQueryDevtools = React.lazy(() =>
  import('@tanstack/react-query-devtools').then(module => ({
    default: module.ReactQueryDevtools
  })).catch(() => ({
    default: () => null // Fallback if devtools fail to load
  }))
);

interface ReactQueryProviderProps {
  children: React.ReactNode;
}

export function ReactQueryProvider({ children }: ReactQueryProviderProps) {
  // Use the optimized query client
  const [queryClient] = useState(() => optimizedQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <React.Suspense fallback={null}>
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-right"
          />
        </React.Suspense>
      )}
    </QueryClientProvider>
  );
}
