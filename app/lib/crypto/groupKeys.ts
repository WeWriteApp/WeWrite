/**
 * Group Key Management
 *
 * Handles generation, sharing, and retrieval of AES group keys.
 * Each group has one AES-256 key that encrypts all its content.
 * The group key is wrapped (encrypted) with each member's RSA public key.
 */

import {
  generateAESKey,
  wrapKeyRSA,
  unwrapKeyRSA,
  importPublicKeyFromJWK,
  exportKeyToJWK,
} from './primitives';

/**
 * Generate a new AES-256 group key.
 */
export async function generateGroupKey(): Promise<CryptoKey> {
  return generateAESKey();
}

/**
 * Encrypt a group key for a specific member using their RSA public key.
 * Returns a base64-encoded wrapped key to store in Firestore.
 */
export async function encryptGroupKeyForMember(
  groupKey: CryptoKey,
  memberPublicKeyJWK: JsonWebKey
): Promise<string> {
  const publicKey = await importPublicKeyFromJWK(memberPublicKeyJWK);
  return wrapKeyRSA(groupKey, publicKey);
}

/**
 * Decrypt a group key using the current user's RSA private key.
 * The wrappedKey comes from groups/{groupId}/keys/{userId}.encryptedGroupKey.
 */
export async function decryptGroupKey(
  wrappedKey: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  return unwrapKeyRSA(wrappedKey, privateKey);
}

/**
 * Export a group key to raw bytes for re-wrapping (e.g., during key rotation).
 */
export async function exportGroupKey(groupKey: CryptoKey): Promise<JsonWebKey> {
  return exportKeyToJWK(groupKey);
}
