"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import UsernameEnforcementModal from './UsernameEnforcementModal';

export default function UsernameEnforcementBanner() {
  const { user, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Only show the modal if the user is logged in, not loading, and has no username
    if (!loading && user && (!user.username || user.username === '')) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [user, loading]);

  if (!showModal) return null;

  return <UsernameEnforcementModal />;
}
