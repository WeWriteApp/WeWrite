'use client';

import { useAuth } from '../../../providers/AuthProvider';
import PWAInstallationCard from '../../utils/PWAInstallationCard';

interface AdvancedContentProps {
  onClose: () => void;
}

export default function AdvancedContent({ onClose }: AdvancedContentProps) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="px-4 pb-6">
      <div className="space-y-8">
        <PWAInstallationCard />
      </div>
    </div>
  );
}
