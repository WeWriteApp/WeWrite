'use client';

import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from "../../components/ui/button";
import { ChevronLeft } from 'lucide-react';

import PWAInstallationCard from '../../components/utils/PWAInstallationCard';

export default function AdvancedPage() {
  const { session } = useCurrentAccount();
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }
  }, [, session, router]);

  if (!session) {
    return null;
  }

  return (
    <div>
      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/settings')}
            className="mr-3"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Advanced</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Desktop Header */}
        <div className="hidden lg:block mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Advanced</h1>
          <p className="text-muted-foreground mt-1">Advanced settings and data management</p>
        </div>

        {/* Advanced Settings Sections */}
        <div className="space-y-8">
          {/* Sync Queue Settings */}

          {/* PWA Installation */}
          <PWAInstallationCard />
        </div>
      </div>
    </div>
  );
}