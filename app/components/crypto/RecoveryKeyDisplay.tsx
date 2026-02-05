'use client';

import React, { useState } from 'react';
import { Icon } from '../ui/Icon';

interface RecoveryKeyDisplayProps {
  recoveryKey: string;
}

/**
 * Displays a recovery key with copy functionality.
 * Used in the passcode setup flow and security settings.
 */
export function RecoveryKeyDisplay({ recoveryKey }: RecoveryKeyDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Store this recovery key somewhere safe
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          If you forget your passcode, this key is the only way to recover your data.
          We cannot recover it for you.
        </p>
      </div>

      <div className="relative p-3 bg-muted rounded-lg">
        <code className="font-mono text-xs break-all select-all block">
          {recoveryKey}
        </code>
      </div>

      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
      >
        <Icon name={copied ? 'Check' : 'Copy'} size={14} />
        {copied ? 'Copied' : 'Copy Recovery Key'}
      </button>
    </div>
  );
}
