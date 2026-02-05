/**
 * Crypto Types
 *
 * Type definitions for the end-to-end encryption system.
 */

/** Encrypted content blob stored in Firestore */
export interface EncryptedContent {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector (12 bytes for AES-GCM) */
  iv: string;
  /** Encryption format version for future migration */
  version: number;
}

/** User's encrypted private key stored in Firestore */
export interface EncryptedPrivateKey {
  /** Base64-encoded ciphertext of the RSA private key (JWK format) */
  ciphertext: string;
  /** Base64-encoded IV used for AES-GCM encryption */
  iv: string;
  /** Base64-encoded salt used for PBKDF2 key derivation */
  salt: string;
  /** Encryption format version */
  version: number;
}

/** A user's public/private key bundle stored in userKeys/{userId} */
export interface UserKeyBundle {
  /** RSA public key in JWK format (readable by anyone) */
  publicKey: JsonWebKey;
  /** Encrypted RSA private key (only decryptable by the user's passcode) */
  encryptedPrivateKey: EncryptedPrivateKey;
  /** SHA-256 hash of the recovery key (for verification during recovery) */
  recoveryKeyHash: string;
  /** When keys were created */
  createdAt: string;
}

/** A group key entry stored in groups/{groupId}/keys/{userId} */
export interface GroupKeyEntry {
  /** Base64-encoded group AES key wrapped with the user's RSA public key */
  encryptedGroupKey: string;
  /** Version of the group key (incremented on rotation) */
  keyVersion: number;
  /** User ID of who granted this key */
  grantedBy: string;
  /** When this key was shared */
  createdAt: string;
}

/** Result of generating a new keypair */
export interface KeyPairGenerationResult {
  /** The RSA public key in JWK format */
  publicKey: JsonWebKey;
  /** The RSA private key in JWK format (to be encrypted before storage) */
  privateKey: JsonWebKey;
}

/** Result of the passcode-based key setup */
export interface KeySetupResult {
  /** The user key bundle to store in Firestore */
  keyBundle: UserKeyBundle;
  /** Recovery key (shown once, user must save it) */
  recoveryKey: string;
}
