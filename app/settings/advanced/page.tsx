'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from "../../components/ui/button";
import { ChevronLeft } from 'lucide-react';
import { SettingsPageHeader } from '../../components/settings/SettingsPageHeader';
import PWAInstallationCard from '../../components/utils/PWAInstallationCard';

export default function AdvancedPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
  }, [, user, router]);

  if (!user) {
    return null;
  }

  return (
    <div>
      <SettingsPageHeader
        title="Advanced"
        description="Advanced settings and data management"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-8">

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