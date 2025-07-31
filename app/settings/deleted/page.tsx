'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from "../../components/ui/button";
import { ChevronLeft } from 'lucide-react';
import NavHeader from '../../components/layout/NavHeader';
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
    <div>
      <div className="lg:hidden">
        <NavHeader backUrl="/settings" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-32 md:pb-8">

        {/* Recently Deleted Pages Component */}
        <RecentlyDeletedPages />
      </div>
    </div>
  );
}