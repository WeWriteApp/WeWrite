/**
 * Key Rotation Service
 *
 * Handles manual group key rotation. When the owner rotates the key:
 * 1. Generate a new AES-256 group key
 * 2. Re-wrap the new key for all current members
 * 3. (Future) Re-encrypt all group page content with the new key
 *
 * Note: Automatic key rotation on member removal is not implemented.
 * The accepted trade-off is that removed members retain access to content
 * encrypted before their removal. The owner can manually rotate if needed.
 */

import { generateAESKey } from '../lib/crypto/primitives';
import { encryptGroupKeyForMember } from '../lib/crypto/groupKeys';
import { fetchMemberPublicKey } from './keyExchangeService';

export interface RotationProgress {
  total: number;
  completed: number;
  failed: string[]; // user IDs that failed
}

/**
 * Rotate the group key for all current members.
 *
 * @param groupId - The group to rotate the key for
 * @param memberIds - Current member user IDs
 * @param onProgress - Callback for progress updates
 * @returns The new group CryptoKey (for re-encryption), or null on failure
 */
export async function rotateGroupKey(
  groupId: string,
  memberIds: string[],
  onProgress?: (progress: RotationProgress) => void
): Promise<CryptoKey | null> {
  const progress: RotationProgress = {
    total: memberIds.length,
    completed: 0,
    failed: [],
  };

  try {
    // Generate a new group key
    const newGroupKey = await generateAESKey();

    // Re-wrap for each member
    for (const memberId of memberIds) {
      try {
        const publicKey = await fetchMemberPublicKey(memberId);
        if (!publicKey) {
          progress.failed.push(memberId);
          progress.completed++;
          onProgress?.(progress);
          continue;
        }

        const encryptedGroupKey = await encryptGroupKeyForMember(newGroupKey, publicKey);

        // Store the new wrapped key
        const res = await fetch(`/api/groups/${groupId}/keys`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: memberId,
            encryptedGroupKey,
            keyVersion: 2, // Incremented version
          }),
        });

        if (!res.ok) {
          progress.failed.push(memberId);
        }
      } catch {
        progress.failed.push(memberId);
      }

      progress.completed++;
      onProgress?.(progress);
    }

    return newGroupKey;
  } catch (error) {
    console.error('[KeyRotation] Error rotating group key:', error);
    return null;
  }
}
