'use client';

/**
 * Admin Index Page
 *
 * - On desktop: Redirects to the first admin section (sidebar needs a selected section)
 * - On mobile: Returns null (MobilePageNav in the layout handles the menu)
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMediaQuery } from '../hooks/use-media-query';

export default function AdminPage() {
  const router = useRouter();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  useEffect(() => {
    if (isDesktop) {
      router.replace('/admin/product-kpis');
    }
  }, [isDesktop, router]);

  // On mobile, the layout's MobilePageNav shows the menu
  return null;
}
