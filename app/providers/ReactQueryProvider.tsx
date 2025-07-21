/**
 * React Query Provider for Firebase Cost Optimization
 * 
 * Provides optimized React Query configuration with aggressive caching
 * to minimize Firebase reads and maximize cost efficiency.
 */

'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { optimizedQueryClient } from '../utils/reactQueryConfig';

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
        <ReactQueryDevtools 
          initialIsOpen={false}
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
