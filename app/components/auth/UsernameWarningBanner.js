'use client';

import React, { useState } from 'react';
import { UsernameModal } from './UsernameModal';
import { useAuth } from '../../providers/AuthProvider';
import { updateUsername } from '../../firebase/usernameHistory';
import { useAlert } from '../../hooks/useAlert';
import AlertModal from '../utils/AlertModal';

export default function UsernameWarningBanner() {
  const { user, setUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Custom modal hooks
  const { alertState, showError, closeAlert } = useAlert();

  // Check if user exists and has no username or a generated username
  const needsUsername = user &&
    (!user.username || user.username.startsWith('user_') || user.username === '');

  if (!needsUsername) return null;

  const handleUsernameSet = async (username) => {
    try {
      // Update username in Firebase
      await updateUsername(user.uid, username);

      // Update local user state
      setUser({
        ...user,
        username
      });

      // Close modal
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error setting username:', error);
      await showError('Username Error', 'Failed to set username. Please try again.');
    }
  };

  return (
    <>
      <div
        className="w-full bg-red-600 text-white py-3 px-4 flex justify-between items-center cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      >
        <div className="flex-1 text-center font-medium">
          Please add a username to your account
        </div>
        <div className="text-sm underline">
          Click to set username
        </div>
      </div>

      <UsernameModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        email={user?.email || ''}
        onUsernameSet={handleUsernameSet}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        buttonText={alertState.buttonText}
        variant={alertState.variant}
        icon={alertState.icon}
      />
    </>
  );
}
