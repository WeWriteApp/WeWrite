'use client';

import { useAuth } from '../../../providers/AuthProvider';
import RecentlyDeletedPages from '../RecentlyDeletedPages';

interface DeletedContentProps {
  onClose: () => void;
}

export default function DeletedContent({ onClose }: DeletedContentProps) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="px-4 pb-6">
      <RecentlyDeletedPages />
    </div>
  );
}
