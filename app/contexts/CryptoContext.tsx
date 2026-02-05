'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../providers/AuthProvider';
import {
  decryptPrivateKey,
  importPrivateKeyFromJWK,
} from '../lib/crypto/primitives';
import { decryptGroupKey } from '../lib/crypto/groupKeys';
import { encryptContent, decryptContent } from '../lib/crypto/contentEncryption';
import type { EncryptedContent, UserKeyBundle } from '../lib/crypto/types';

const AUTO_LOCK_MS = 30 * 60 * 1000; // 30 minutes

interface CryptoContextValue {
  /** Whether the user has encryption keys set up */
  hasKeys: boolean;
  /** Whether keys are loaded and the private key is unlocked */
  isKeyUnlocked: boolean;
  /** Loading state while checking key status */
  isLoading: boolean;
  /** Unlock the private key with the user's passcode */
  unlockKeys: (passcode: string) => Promise<boolean>;
  /** Clear the private key from memory */
  lockKeys: () => void;
  /** Get (and cache) a decrypted group AES key */
  getGroupKey: (groupId: string) => Promise<CryptoKey | null>;
  /** Encrypt content for a group */
  encryptForGroup: (content: unknown, groupId: string) => Promise<EncryptedContent | null>;
  /** Decrypt content from a group */
  decryptForGroup: (encrypted: EncryptedContent, groupId: string) => Promise<unknown | null>;
  /** Refresh key status from server */
  refreshKeyStatus: () => Promise<void>;
}

const CryptoContext = createContext<CryptoContextValue>({
  hasKeys: false,
  isKeyUnlocked: false,
  isLoading: true,
  unlockKeys: async () => false,
  lockKeys: () => {},
  getGroupKey: async () => null,
  encryptForGroup: async () => null,
  decryptForGroup: async () => null,
  refreshKeyStatus: async () => {},
});

export function CryptoProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [hasKeys, setHasKeys] = useState(false);
  const [isKeyUnlocked, setIsKeyUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // In-memory only — never persisted
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const groupKeyCache = useRef<Map<string, CryptoKey>>(new Map());
  const autoLockTimer = useRef<NodeJS.Timeout | null>(null);
  const keyBundleRef = useRef<UserKeyBundle | null>(null);

  // Reset auto-lock timer on any crypto activity
  const resetAutoLock = useCallback(() => {
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
    autoLockTimer.current = setTimeout(() => {
      privateKeyRef.current = null;
      groupKeyCache.current.clear();
      setIsKeyUnlocked(false);
    }, AUTO_LOCK_MS);
  }, []);

  // Check if user has keys on mount
  const refreshKeyStatus = useCallback(async () => {
    if (!user?.uid) {
      setHasKeys(false);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/user-keys', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data) {
        setHasKeys(data.data.hasKeys);
        if (data.data.keyBundle) {
          keyBundleRef.current = data.data.keyBundle;
        }
      }
    } catch {
      // Fail silently — encryption is optional
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    refreshKeyStatus();
  }, [refreshKeyStatus]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
      privateKeyRef.current = null;
      groupKeyCache.current.clear();
    };
  }, []);

  // Lock when user logs out
  useEffect(() => {
    if (!user) {
      privateKeyRef.current = null;
      groupKeyCache.current.clear();
      keyBundleRef.current = null;
      setIsKeyUnlocked(false);
      setHasKeys(false);
    }
  }, [user]);

  const unlockKeys = useCallback(async (passcode: string): Promise<boolean> => {
    try {
      // Fetch key bundle if we don't have it
      if (!keyBundleRef.current) {
        const res = await fetch('/api/user-keys', { credentials: 'include' });
        const data = await res.json();
        if (!data.success || !data.data?.keyBundle) return false;
        keyBundleRef.current = data.data.keyBundle;
      }

      const bundle = keyBundleRef.current;
      if (!bundle) return false;
      const { encryptedPrivateKey } = bundle;

      // Decrypt the private key with the passcode
      const privateKeyJWK = await decryptPrivateKey(
        encryptedPrivateKey.ciphertext,
        encryptedPrivateKey.iv,
        encryptedPrivateKey.salt,
        passcode
      );

      // Import as CryptoKey
      const privateKey = await importPrivateKeyFromJWK(privateKeyJWK);
      privateKeyRef.current = privateKey;
      setIsKeyUnlocked(true);
      resetAutoLock();
      return true;
    } catch {
      // Wrong passcode or corrupt data
      return false;
    }
  }, [resetAutoLock]);

  const lockKeys = useCallback(() => {
    privateKeyRef.current = null;
    groupKeyCache.current.clear();
    setIsKeyUnlocked(false);
    if (autoLockTimer.current) clearTimeout(autoLockTimer.current);
  }, []);

  const getGroupKey = useCallback(async (groupId: string): Promise<CryptoKey | null> => {
    // Check cache first
    const cached = groupKeyCache.current.get(groupId);
    if (cached) {
      resetAutoLock();
      return cached;
    }

    if (!privateKeyRef.current) return null;

    try {
      // Fetch wrapped group key from API
      const res = await fetch(`/api/groups/${groupId}/keys`, { credentials: 'include' });
      const data = await res.json();

      if (!data.success || !data.data?.hasKey) return null;

      // Unwrap using private key
      const groupKey = await decryptGroupKey(
        data.data.encryptedGroupKey,
        privateKeyRef.current
      );

      // Cache it
      groupKeyCache.current.set(groupId, groupKey);
      resetAutoLock();
      return groupKey;
    } catch {
      return null;
    }
  }, [resetAutoLock]);

  const encryptForGroup = useCallback(async (
    content: unknown,
    groupId: string
  ): Promise<EncryptedContent | null> => {
    const groupKey = await getGroupKey(groupId);
    if (!groupKey) return null;

    try {
      return await encryptContent(content, groupKey);
    } catch {
      return null;
    }
  }, [getGroupKey]);

  const decryptForGroup = useCallback(async (
    encrypted: EncryptedContent,
    groupId: string
  ): Promise<unknown | null> => {
    const groupKey = await getGroupKey(groupId);
    if (!groupKey) return null;

    try {
      return await decryptContent(encrypted, groupKey);
    } catch {
      return null;
    }
  }, [getGroupKey]);

  return (
    <CryptoContext.Provider
      value={{
        hasKeys,
        isKeyUnlocked,
        isLoading,
        unlockKeys,
        lockKeys,
        getGroupKey,
        encryptForGroup,
        decryptForGroup,
        refreshKeyStatus,
      }}
    >
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  return useContext(CryptoContext);
}

export default CryptoContext;
