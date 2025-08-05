'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import RecentlyDeletedPages from '../../components/settings/RecentlyDeletedPages';

export default function RecentlyDeletedPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Recently Deleted Pages Component */}
      <RecentlyDeletedPages />
    </div>
  );
}