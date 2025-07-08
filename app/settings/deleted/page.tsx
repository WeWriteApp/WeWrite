'use client';

import { useCurrentAccount } from "../../providers/CurrentAccountProvider";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from "../../components/ui/button";
import { ChevronLeft } from 'lucide-react';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import RecentlyDeletedPages from '../../components/settings/RecentlyDeletedPages';

export default function RecentlyDeletedPage() {
  const { currentAccount, isAuthenticated } = useCurrentAccount();
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
      <SettingsPageHeader
        title="Recently deleted"
        description="Recover or permanently delete pages"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-32 md:pb-8">

        {/* Recently Deleted Pages Component */}
        <RecentlyDeletedPages />
      </div>
    </div>
  );
}