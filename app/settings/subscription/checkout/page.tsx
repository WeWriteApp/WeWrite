'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CheckoutRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Preserve query parameters and redirect to new checkout page
    const params = new URLSearchParams(searchParams);
    const queryString = params.toString();
    const newUrl = `/settings/fund-account/checkout${queryString ? `?${queryString}` : ''}`;
    router.replace(newUrl);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-lg font-medium mb-2">Redirecting...</h1>
        <p className="text-muted-foreground">Taking you to the account funding checkout</p>
      </div>
    </div>
  );
}
