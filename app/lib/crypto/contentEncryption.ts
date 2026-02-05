/**
 * Content Encryption
 *
 * Encrypts and decrypts page content (Slate.js EditorContent[]) using
 * an AES-256-GCM group key. Content is serialized to JSON before encryption.
 */

import { encryptAES, decryptAES } from './primitives';
import type { EncryptedContent } from './types';

/** Current encryption format version */
const ENCRYPTION_VERSION = 1;

/**
 * Encrypt page content for storage.
 *
 * Flow: EditorContent[] → JSON.stringify → TextEncoder → AES-256-GCM → EncryptedContent
 */
export async function encryptContent(
  content: unknown,
  groupKey: CryptoKey
): Promise<EncryptedContent> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(content));

  const { ciphertext, iv } = await encryptAES(plaintext.buffer as ArrayBuffer, groupKey);

  return {
    ciphertext,
    iv,
    version: ENCRYPTION_VERSION,
  };
}

/**
 * Decrypt page content from storage.
 *
 * Flow: EncryptedContent → AES-256-GCM decrypt → TextDecoder → JSON.parse → EditorContent[]
 */
export async function decryptContent(
  encrypted: EncryptedContent,
  groupKey: CryptoKey
): Promise<unknown> {
  if (encrypted.version !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported encryption version: ${encrypted.version}`);
  }

  const decrypted = await decryptAES(encrypted.ciphertext, encrypted.iv, groupKey);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

/**
 * Check if a content value is an encrypted content blob.
 */
export function isEncryptedContent(content: unknown): content is EncryptedContent {
  if (!content || typeof content !== 'object') return false;
  const obj = content as Record<string, unknown>;
  return (
    typeof obj.ciphertext === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.version === 'number'
  );
}
