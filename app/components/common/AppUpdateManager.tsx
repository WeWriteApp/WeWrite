'use client';

import React from 'react';
import { useAppUpdate } from '../../hooks/useAppUpdate';
import AppUpdateModal from './AppUpdateModal';

export default function AppUpdateManager() {
  const { showModal, dismissUpdate, applyUpdate } = useAppUpdate();

  return (
    <AppUpdateModal
      isOpen={showModal}
      onClose={dismissUpdate}
      onRefresh={applyUpdate}
    />
  );
}
