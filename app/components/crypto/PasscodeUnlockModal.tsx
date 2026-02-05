'use client';

import React, { useState } from 'react';
import { AdaptiveModal } from '../ui/adaptive-modal';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/input';
import { useCrypto } from '../../hooks/useCrypto';

interface PasscodeUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
}

export function PasscodeUnlockModal({ isOpen, onClose, onUnlocked }: PasscodeUnlockModalProps) {
  const { unlockKeys } = useCrypto();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleSubmit = async () => {
    if (passcode.length !== 6) {
      setError('Passcode must be 6 digits');
      return;
    }

    setIsUnlocking(true);
    setError(null);

    const success = await unlockKeys(passcode);

    if (success) {
      setPasscode('');
      onUnlocked?.();
      onClose();
    } else {
      setError('Incorrect passcode');
      setPasscode('');
    }

    setIsUnlocking(false);
  };

  return (
    <AdaptiveModal
      isOpen={isOpen}
      onClose={onClose}
      title="Unlock Encryption"
    >
      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter your 6-digit passcode to unlock encrypted content.
        </p>

        <Input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={passcode}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
            setPasscode(digits);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          placeholder="Enter passcode"
          className="text-center text-2xl tracking-[0.5em] font-mono h-auto py-3"
          autoFocus
          disabled={isUnlocking}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={passcode.length !== 6 || isUnlocking}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
        >
          {isUnlocking ? <Icon name="Loader" size={16} /> : 'Unlock'}
        </button>
      </div>
    </AdaptiveModal>
  );
}
