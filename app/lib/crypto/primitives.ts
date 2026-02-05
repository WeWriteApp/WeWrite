/**
 * Crypto Primitives
 *
 * Low-level cryptographic operations using the Web Crypto API.
 * All operations are client-side only — private keys never leave the browser.
 *
 * Algorithms:
 * - Content encryption: AES-256-GCM (12-byte random IV)
 * - Group key wrapping: RSA-OAEP (4096-bit)
 * - Private key protection: AES-256-GCM + PBKDF2
 * - Key derivation: PBKDF2 (600k iterations, SHA-256)
 */

// ─── Helpers ──────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

// ─── AES-256-GCM ─────────────────────────────────────────────────

/**
 * Encrypt data with AES-256-GCM.
 * Returns base64-encoded ciphertext and IV.
 */
export async function encryptAES(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = generateRandomBytes(12); // 96-bit IV for GCM

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt AES-256-GCM encrypted data.
 */
export async function decryptAES(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToArrayBuffer(iv) },
    key,
    base64ToArrayBuffer(ciphertext)
  );
}

/**
 * Generate a new AES-256 key for content encryption.
 */
export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable (needed for wrapping)
    ['encrypt', 'decrypt']
  );
}

// ─── RSA-OAEP (4096-bit) ─────────────────────────────────────────

/**
 * Generate an RSA-OAEP 4096-bit key pair for key wrapping.
 */
export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // extractable
    ['wrapKey', 'unwrapKey']
  );
}

/**
 * Wrap (encrypt) an AES key using an RSA public key.
 * Returns base64-encoded wrapped key.
 */
export async function wrapKeyRSA(
  keyToWrap: CryptoKey,
  publicKey: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    keyToWrap,
    publicKey,
    { name: 'RSA-OAEP' }
  );
  return arrayBufferToBase64(wrapped);
}

/**
 * Unwrap (decrypt) an AES key using an RSA private key.
 */
export async function unwrapKeyRSA(
  wrappedKey: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    base64ToArrayBuffer(wrappedKey),
    privateKey,
    { name: 'RSA-OAEP' },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export an RSA key to JWK format.
 */
export async function exportKeyToJWK(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

/**
 * Import an RSA public key from JWK format.
 */
export async function importPublicKeyFromJWK(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['wrapKey']
  );
}

/**
 * Import an RSA private key from JWK format.
 */
export async function importPrivateKeyFromJWK(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false, // non-extractable once imported
    ['unwrapKey']
  );
}

// ─── PBKDF2 (Passcode → Key) ─────────────────────────────────────

const PBKDF2_ITERATIONS = 600_000;

/**
 * Derive an AES-256 key from a 6-digit passcode using PBKDF2.
 * The salt should be random and stored alongside the encrypted data.
 */
export async function deriveKeyFromPasscode(
  passcode: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an RSA private key (JWK) with a passcode-derived AES key.
 */
export async function encryptPrivateKey(
  privateKeyJWK: JsonWebKey,
  passcode: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = generateRandomBytes(32);
  const derivedKey = await deriveKeyFromPasscode(passcode, salt);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(privateKeyJWK));

  const { ciphertext, iv } = await encryptAES(plaintext.buffer as ArrayBuffer, derivedKey);

  return {
    ciphertext,
    iv,
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  };
}

/**
 * Decrypt an RSA private key (JWK) using a passcode.
 */
export async function decryptPrivateKey(
  ciphertext: string,
  iv: string,
  salt: string,
  passcode: string
): Promise<JsonWebKey> {
  const saltBytes = new Uint8Array(base64ToArrayBuffer(salt));
  const derivedKey = await deriveKeyFromPasscode(passcode, saltBytes);

  const decrypted = await decryptAES(ciphertext, iv, derivedKey);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

// ─── Recovery Key ─────────────────────────────────────────────────

/**
 * Generate a random recovery key (32 bytes, displayed as hex).
 */
export function generateRecoveryKey(): string {
  const bytes = generateRandomBytes(32);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a recovery key for verification storage.
 */
export async function hashRecoveryKey(recoveryKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(recoveryKey));
  return arrayBufferToBase64(hash);
}

// ─── Utility Exports ──────────────────────────────────────────────

export { arrayBufferToBase64, base64ToArrayBuffer, generateRandomBytes };
