/**
 * Key Exchange Service
 *
 * Handles sharing group encryption keys with new members.
 * When a member joins an encrypted group, the inviter wraps the group key
 * with the new member's RSA public key and stores it in Firestore.
 *
 * This runs client-side — the inviter's browser does the wrapping.
 */

import {
  importPublicKeyFromJWK,
  wrapKeyRSA,
  unwrapKeyRSA,
  generateAESKey,
  exportKeyToJWK,
} from '../lib/crypto/primitives';
import { encryptGroupKeyForMember } from '../lib/crypto/groupKeys';

/**
 * Share a group key with a new member.
 * Called from the inviter's client after the invitation is accepted.
 *
 * @param groupId - The group to share the key for
 * @param groupKey - The decrypted group AES key (from the inviter's cache)
 * @param targetUserId - The new member's user ID
 * @param targetPublicKeyJWK - The new member's RSA public key (JWK)
 */
export async function shareGroupKeyWithMember(
  groupId: string,
  groupKey: CryptoKey,
  targetUserId: string,
  targetPublicKeyJWK: JsonWebKey
): Promise<boolean> {
  try {
    // Wrap the group key with the new member's public key
    const encryptedGroupKey = await encryptGroupKeyForMember(groupKey, targetPublicKeyJWK);

    // Store the wrapped key on the server
    const res = await fetch(`/api/groups/${groupId}/keys`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUserId,
        encryptedGroupKey,
        keyVersion: 1,
      }),
    });

    const data = await res.json();
    return res.ok && data.success;
  } catch (error) {
    console.error('[KeyExchange] Error sharing group key:', error);
    return false;
  }
}

/**
 * Fetch a member's public key from the server.
 */
export async function fetchMemberPublicKey(
  userId: string
): Promise<JsonWebKey | null> {
  try {
    const res = await fetch(`/api/user-keys/${userId}/public`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success && data.data?.publicKey) {
      return data.data.publicKey;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a member has encryption keys set up.
 */
export async function memberHasKeys(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/user-keys/${userId}/public`, {
      credentials: 'include',
    });
    const data = await res.json();
    return data.success && data.data?.hasKeys === true;
  } catch {
    return false;
  }
}
