'use client';

import { useAuth } from '../../providers/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from "../../components/ui/button";
import { ChevronLeft } from 'lucide-react';
import NavPageLayout from '../../components/layout/NavPageLayout';
import PWAInstallationCard from '../../components/utils/PWAInstallationCard';
import LoggedInDevices from '../../components/settings/LoggedInDevices';

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
    <NavPageLayout backUrl="/settings">

        {/* Advanced Settings Sections */}
        <div className="space-y-8">
          {/* Logged in devices */}
          <LoggedInDevices />

          {/* PWA Installation */}
          <PWAInstallationCard />
        </div>
    </NavPageLayout>
  );
}