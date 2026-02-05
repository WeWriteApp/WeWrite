'use client';

import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { PasscodeUnlockModal } from './PasscodeUnlockModal';
import { PasscodeSetupModal } from './PasscodeSetupModal';
import { useCrypto } from '../../hooks/useCrypto';

interface EncryptedPagePlaceholderProps {
  onUnlocked?: () => void;
}

/**
 * Shown when a user views an encrypted page but hasn't unlocked their keys yet.
 */
export function EncryptedPagePlaceholder({ onUnlocked }: EncryptedPagePlaceholderProps) {
  const { hasKeys, isKeyUnlocked } = useCrypto();
  const [showUnlock, setShowUnlock] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  if (isKeyUnlocked) return null;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon name="Lock" size={24} className="text-muted-foreground" />
      </div>

      <h2 className="text-lg font-medium mb-1">This page is encrypted</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {hasKeys
          ? 'Enter your passcode to view this content.'
          : 'Set up encryption to view encrypted group content.'}
      </p>

      {hasKeys ? (
        <button
          onClick={() => setShowUnlock(true)}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Icon name="Key" size={16} className="inline mr-1.5" />
          Unlock
        </button>
      ) : (
        <button
          onClick={() => setShowSetup(true)}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <Icon name="Shield" size={16} className="inline mr-1.5" />
          Set Up Encryption
        </button>
      )}

      <PasscodeUnlockModal
        isOpen={showUnlock}
        onClose={() => setShowUnlock(false)}
        onUnlocked={onUnlocked}
      />

      <PasscodeSetupModal
        isOpen={showSetup}
        onClose={() => setShowSetup(false)}
        onComplete={() => {
          setShowSetup(false);
          setShowUnlock(true);
        }}
      />
    </div>
  );
}
