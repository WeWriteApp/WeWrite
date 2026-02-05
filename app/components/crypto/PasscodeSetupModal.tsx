'use client';

import React, { useState } from 'react';
import { AdaptiveModal } from '../ui/adaptive-modal';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/input';
import {
  generateRSAKeyPair,
  exportKeyToJWK,
  encryptPrivateKey,
  generateRecoveryKey,
  hashRecoveryKey,
} from '../../lib/crypto/primitives';
import { useCrypto } from '../../hooks/useCrypto';

interface PasscodeSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function PasscodeSetupModal({ isOpen, onClose, onComplete }: PasscodeSetupModalProps) {
  const { refreshKeyStatus } = useCrypto();
  const [step, setStep] = useState<'enter' | 'confirm' | 'recovery' | 'saving'>('enter');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handlePasscodeChange = (value: string) => {
    // Only allow digits, max 6
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (step === 'enter') {
      setPasscode(digits);
      setError(null);
    } else if (step === 'confirm') {
      setConfirmPasscode(digits);
      setError(null);
    }
  };

  const handleEnterSubmit = () => {
    if (passcode.length !== 6) {
      setError('Passcode must be exactly 6 digits');
      return;
    }
    setStep('confirm');
  };

  const handleConfirmSubmit = () => {
    if (confirmPasscode !== passcode) {
      setError('Passcodes do not match');
      setConfirmPasscode('');
      return;
    }
    generateKeys();
  };

  const generateKeys = async () => {
    setStep('saving');
    setIsSaving(true);
    setError(null);

    try {
      // Generate RSA key pair
      const keyPair = await generateRSAKeyPair();
      const publicKeyJWK = await exportKeyToJWK(keyPair.publicKey);
      const privateKeyJWK = await exportKeyToJWK(keyPair.privateKey);

      // Encrypt private key with passcode
      const encryptedPrivateKey = await encryptPrivateKey(privateKeyJWK, passcode);

      // Generate recovery key
      const recovery = generateRecoveryKey();
      const recoveryHash = await hashRecoveryKey(recovery);
      setRecoveryKey(recovery);

      // Store keys on server
      const res = await fetch('/api/user-keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: publicKeyJWK,
          encryptedPrivateKey: {
            ciphertext: encryptedPrivateKey.ciphertext,
            iv: encryptedPrivateKey.iv,
            salt: encryptedPrivateKey.salt,
            version: 1,
          },
          recoveryKeyHash: recoveryHash,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to store keys');
      }

      await refreshKeyStatus();
      setStep('recovery');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate keys');
      setStep('confirm');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecoveryDone = () => {
    setPasscode('');
    setConfirmPasscode('');
    setRecoveryKey('');
    setStep('enter');
    onComplete();
    onClose();
  };

  const renderCurrentStep = () => {
    if (step === 'enter') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose a 6-digit passcode to protect your encryption keys. You'll need this to unlock encrypted content.
          </p>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={passcode}
            onChange={(e) => handlePasscodeChange(e.target.value)}
            placeholder="Enter 6-digit passcode"
            className="text-center text-2xl tracking-[0.5em] font-mono h-auto py-3"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={handleEnterSubmit}
            disabled={passcode.length !== 6}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      );
    }

    if (step === 'confirm') {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirm your 6-digit passcode.
          </p>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmPasscode}
            onChange={(e) => handlePasscodeChange(e.target.value)}
            placeholder="Re-enter passcode"
            className="text-center text-2xl tracking-[0.5em] font-mono h-auto py-3"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={handleConfirmSubmit}
            disabled={confirmPasscode.length !== 6}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50"
          >
            Set Passcode
          </button>
          <button
            onClick={() => { setStep('enter'); setConfirmPasscode(''); }}
            className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Go back
          </button>
        </div>
      );
    }

    if (step === 'saving') {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Icon name="Loader" size={24} />
          <p className="text-sm text-muted-foreground">Generating encryption keys...</p>
        </div>
      );
    }

    if (step === 'recovery') {
      return (
        <div className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">
              Save your recovery key
            </p>
            <p className="text-xs text-muted-foreground">
              If you forget your passcode, this is the only way to recover your encrypted data.
              Store it somewhere safe — we cannot recover it for you.
            </p>
          </div>

          <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all select-all cursor-text">
            {recoveryKey}
          </div>

          <button
            onClick={() => navigator.clipboard.writeText(recoveryKey)}
            className="w-full px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Icon name="Copy" size={14} className="inline mr-1.5" />
            Copy Recovery Key
          </button>

          <button
            onClick={handleRecoveryDone}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
          >
            I've Saved It
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <AdaptiveModal
      isOpen={isOpen}
      onClose={step === 'recovery' ? handleRecoveryDone : onClose}
      title="Set Up Encryption"
    >
      <div className="p-4">
        {renderCurrentStep()}
      </div>
    </AdaptiveModal>
  );
}
