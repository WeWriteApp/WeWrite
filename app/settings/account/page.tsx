'use client';

import { useAuth } from "../../providers/AuthProvider";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from "../../components/ui/button";
import { ChevronLeft } from 'lucide-react';
import { SyncQueueSettings } from '../../components/utils/SyncQueueSettings';
import PWAInstallationCard from '../../components/utils/PWAInstallationCard';

export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
  }, [user, router]);

  if (!user) {
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
          <h1 className="text-lg font-semibold">Account</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Desktop Header */}
        <div className="hidden lg:block mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Account</h1>
          <p className="text-muted-foreground mt-1">Manage account data and app settings</p>
        </div>

        {/* Account Settings Sections */}
        <div className="space-y-8">
          {/* Sync Queue Settings */}
          <SyncQueueSettings />

          {/* PWA Installation */}
          <PWAInstallationCard />
        </div>
      </div>
    </div>
  );
}
