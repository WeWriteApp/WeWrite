'use client';

import React, { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/badge';
import { useCrypto } from '../../../hooks/useCrypto';
import { PasscodeSetupModal } from '../../../components/crypto/PasscodeSetupModal';
import { PasscodeUnlockModal } from '../../../components/crypto/PasscodeUnlockModal';
import { PasscodeRecoveryModal } from '../../../components/crypto/PasscodeRecoveryModal';

export default function EncryptionSettingsPage() {
  const { hasKeys, isKeyUnlocked, isLoading, lockKeys } = useCrypto();
  const [showSetup, setShowSetup] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Icon name="Loader" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Icon name="Shield" size={20} />
        <h1 className="text-xl font-bold">Encryption</h1>
      </div>

      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
          <div>
            <h3 className="text-sm font-medium">Encryption Keys</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasKeys ? 'Your encryption keys are set up.' : 'No encryption keys found.'}
            </p>
          </div>
          <Badge variant={hasKeys ? 'default' : 'secondary'} size="sm">
            {hasKeys ? 'Active' : 'Not Set Up'}
          </Badge>
        </div>

        {/* Key Status */}
        {hasKeys && (
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <h3 className="text-sm font-medium">Key Status</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isKeyUnlocked
                  ? 'Keys are unlocked for this session. Auto-locks after 30 minutes of inactivity.'
                  : 'Keys are locked. Enter your passcode to unlock.'}
              </p>
            </div>
            {isKeyUnlocked ? (
              <button
                onClick={lockKeys}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Lock Now
              </button>
            ) : (
              <button
                onClick={() => setShowUnlock(true)}
                className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Unlock
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          {!hasKeys && (
            <button
              onClick={() => setShowSetup(true)}
              className="w-full flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <Icon name="Key" size={18} className="text-primary" />
              <div>
                <h3 className="text-sm font-medium">Set Up Encryption</h3>
                <p className="text-xs text-muted-foreground">
                  Create a passcode to enable end-to-end encryption for group content.
                </p>
              </div>
            </button>
          )}

          {hasKeys && (
            <button
              onClick={() => setShowRecovery(true)}
              className="w-full flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <Icon name="RotateCcw" size={18} className="text-muted-foreground" />
              <div>
                <h3 className="text-sm font-medium">Recover Access</h3>
                <p className="text-xs text-muted-foreground">
                  Use your recovery key if you've forgotten your passcode.
                </p>
              </div>
            </button>
          )}
        </div>

        {/* Security info */}
        <div className="p-4 bg-muted/50 rounded-lg mt-4">
          <h3 className="text-sm font-medium mb-2">How encryption works</h3>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>Your content is encrypted in your browser before being sent to the server.</li>
            <li>Only group members with the group key can decrypt the content.</li>
            <li>Your private key is protected by your 6-digit passcode.</li>
            <li>We never have access to your passcode or private key.</li>
            <li>If you lose your passcode and recovery key, encrypted data cannot be recovered.</li>
          </ul>
        </div>
      </div>

      <PasscodeSetupModal
        isOpen={showSetup}
        onClose={() => setShowSetup(false)}
        onComplete={() => setShowSetup(false)}
      />
      <PasscodeUnlockModal
        isOpen={showUnlock}
        onClose={() => setShowUnlock(false)}
      />
      <PasscodeRecoveryModal
        isOpen={showRecovery}
        onClose={() => setShowRecovery(false)}
      />
    </div>
  );
}
