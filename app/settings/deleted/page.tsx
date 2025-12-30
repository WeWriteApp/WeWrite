'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import RecentlyDeletedPages from '../../components/settings/RecentlyDeletedPages';

export default function RecentlyDeletedPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated (only after auth has finished loading)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }
  }, [isLoading, isAuthenticated, router]);

  // Show nothing while loading or not authenticated
  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Recently Deleted Pages Component */}
      <RecentlyDeletedPages />
    </div>
  );
}