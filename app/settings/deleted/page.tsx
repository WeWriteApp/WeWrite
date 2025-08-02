'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from "../../components/ui/button";
import { ChevronLeft } from 'lucide-react';
import NavPageLayout from '../../components/layout/NavPageLayout';
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
    <NavPageLayout backUrl="/settings">

        {/* Recently Deleted Pages Component */}
        <RecentlyDeletedPages />
    </NavPageLayout>
  );
}