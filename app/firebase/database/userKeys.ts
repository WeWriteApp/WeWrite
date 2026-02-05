/**
 * User Keys Database Module
 *
 * Firestore CRUD for user encryption key bundles.
 * Collection: userKeys/{userId}
 */

import {
  db,
  doc,
  getDoc,
  setDoc,
} from './core';
import { getCollectionName } from '../../utils/environmentConfig';
import type { UserKeyBundle } from '../../lib/crypto/types';

/**
 * Store a user's key bundle (public key + encrypted private key).
 */
export async function saveUserKeyBundle(
  userId: string,
  keyBundle: UserKeyBundle
): Promise<boolean> {
  try {
    const docRef = doc(db, getCollectionName('userKeys'), userId);
    await setDoc(docRef, keyBundle);
    return true;
  } catch (error) {
    console.error('[UserKeys] Error saving key bundle:', error);
    return false;
  }
}

/**
 * Get a user's full key bundle (own keys — includes encrypted private key).
 */
export async function getUserKeyBundle(
  userId: string
): Promise<UserKeyBundle | null> {
  try {
    const docRef = doc(db, getCollectionName('userKeys'), userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data() as UserKeyBundle;
  } catch (error) {
    console.error('[UserKeys] Error fetching key bundle:', error);
    return null;
  }
}

/**
 * Get a user's public key only (for encrypting a group key for them).
 */
export async function getUserPublicKey(
  userId: string
): Promise<JsonWebKey | null> {
  try {
    const docRef = doc(db, getCollectionName('userKeys'), userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return docSnap.data()?.publicKey || null;
  } catch (error) {
    console.error('[UserKeys] Error fetching public key:', error);
    return null;
  }
}

/**
 * Check if a user has encryption keys set up.
 */
export async function hasUserKeys(userId: string): Promise<boolean> {
  try {
    const docRef = doc(db, getCollectionName('userKeys'), userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch {
    return false;
  }
}

/**
 * Store a wrapped group key for a user.
 * Path: groups/{groupId}/keys/{userId}
 */
export async function saveGroupKeyForUser(
  groupId: string,
  userId: string,
  data: {
    encryptedGroupKey: string;
    keyVersion: number;
    grantedBy: string;
  }
): Promise<boolean> {
  try {
    const docRef = doc(
      db,
      getCollectionName('groups'),
      groupId,
      'keys',
      userId
    );
    await setDoc(docRef, {
      ...data,
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('[UserKeys] Error saving group key:', error);
    return false;
  }
}

/**
 * Get a user's wrapped group key.
 */
export async function getGroupKeyForUser(
  groupId: string,
  userId: string
): Promise<{ encryptedGroupKey: string; keyVersion: number } | null> {
  try {
    const docRef = doc(
      db,
      getCollectionName('groups'),
      groupId,
      'keys',
      userId
    );
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
      encryptedGroupKey: data.encryptedGroupKey,
      keyVersion: data.keyVersion,
    };
  } catch (error) {
    console.error('[UserKeys] Error fetching group key:', error);
    return null;
  }
}

/**
 * Delete a user's wrapped group key (on member removal).
 */
export async function deleteGroupKeyForUser(
  groupId: string,
  userId: string
): Promise<boolean> {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    const docRef = doc(
      db,
      getCollectionName('groups'),
      groupId,
      'keys',
      userId
    );
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('[UserKeys] Error deleting group key:', error);
    return false;
  }
}
