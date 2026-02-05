# Private Pages System

## Overview

Private pages are only visible to members of the group they belong to. This feature extends the existing page visibility model to support restricted access within groups.

- Feature-flagged under `private_pages`, defaulted to **off** (auto-enabled for admins)
- Separate flag from `groups` because private pages depend on groups but could be rolled out at a different time
- Requires the `groups` feature to be enabled (a page must belong to a group to be private)

## Status

**Phase 1 Access Control** — Implemented (as part of Groups Foundation)
- `checkPageAccess()` enforces private group page visibility
- Private pages excluded from Typesense search index
- Private pages excluded from sitemap generation

**Phase 3-5 (Encryption)** — Planned

## Data Model

### Page document fields

| Field | Type | Default | Description |
|---|---|---|---|
| `visibility` | `"public"` \| `"private"` | `undefined` (treated as public) | Controls who can view the page |
| `groupId` | `string` | `undefined` | The group this page belongs to |

### Constraints

- Private visibility is only valid when the page belongs to a group (`groupId` is set)
- When a page is added to a private group, `visibility` is set to `"private"` automatically
- If a page is removed from its group, `groupId` and `visibility` are cleared via `FieldValue.delete()`

## Access Control (implemented)

### `checkPageAccess()` — `app/firebase/database/access.ts`
- Page owner always has access
- If `page.visibility === 'private'` and `page.groupId` is set:
  - Fetches group via `getGroupById()`
  - Checks if user ID is in `group.memberIds`
  - Non-members receive "Page not found" (no information leak)
- All other pages are accessible publicly

### `canUserEditPage()` — `app/firebase/database/access.ts`
- Page owner can always edit
- Group members can edit group pages (via `isGroupMember()`)

## Search & Indexing (implemented)

### Typesense
- `app/lib/typesenseSync.ts`: Pages with `visibility: 'private'` are removed from the search index entirely
- Schema includes `groupId` and `visibility` fields for filtering

### Sitemap
- `app/utils/sitemapGenerator.ts`: Pages with `visibility: 'private'` are excluded from sitemap generation

## Exclusions for private pages (implemented)

Private pages are excluded from:
- Typesense search index (removed on sync)
- Sitemap XML generation
- Home feed (`/api/home` filters `visibility: 'private'`)
- Firestore search results (`/api/search` skips private pages)
- Batch page loading (`/api/pages/batch` skips private pages for non-owners)
- SSR content rendering (no `ServerContentForSEO` for private pages)
- SEO metadata (returns generic "Private Page" title, no description)

## Earnings

- Private pages still earn allocations from group members
- Fund flow follows group distribution rules (see [Groups System](./GROUPS_SYSTEM.md))
- Private pages do not earn from non-members (since non-members cannot view or allocate to them)

## End-to-End Encryption (Phases 3-5) — Implemented

### Architecture
- **Content encryption**: AES-256-GCM (12-byte random IV)
- **Key wrapping**: RSA-OAEP (4096-bit per user)
- **Private key protection**: AES-256-GCM + PBKDF2 (600k iterations, SHA-256)
- **Passcode**: 6-digit user-set passcode derives the AES key protecting the RSA private key
- **Group key**: One AES-256 key per group, wrapped with each member's RSA public key

### Crypto Modules
| Module | Description |
|--------|-------------|
| `app/lib/crypto/primitives.ts` | AES-GCM, RSA-OAEP, PBKDF2, recovery key generation |
| `app/lib/crypto/groupKeys.ts` | Group key generation, wrapping, unwrapping |
| `app/lib/crypto/contentEncryption.ts` | Content encrypt/decrypt (Slate.js content → AES blob) |
| `app/lib/crypto/types.ts` | EncryptedContent, UserKeyBundle, GroupKeyEntry types |

### Key Storage
| Collection | Description |
|-----------|-------------|
| `userKeys/{userId}` | RSA public key + encrypted private key + recovery key hash |
| `groups/{groupId}/keys/{userId}` | Wrapped group AES key per member |

### UI Components
| Component | Description |
|----------|-------------|
| `PasscodeSetupModal` | 6-digit passcode entry, RSA keypair generation, recovery key display |
| `PasscodeUnlockModal` | Passcode entry to decrypt private key for session |
| `EncryptedPagePlaceholder` | Lock icon + unlock prompt for encrypted pages |
| `RecoveryKeyDisplay` | Copy-friendly recovery key display |
| `PasscodeRecoveryModal` | Recovery key verification flow |

### API Routes
| Route | Description |
|-------|-------------|
| `POST /api/user-keys` | Store user's key bundle |
| `GET /api/user-keys` | Get own key bundle |
| `GET /api/user-keys/[userId]/public` | Get any user's public key |
| `POST /api/groups/[id]/keys` | Store wrapped group key for a member |
| `GET /api/groups/[id]/keys` | Get own wrapped group key |

### Context
- `CryptoContext` provides `unlockKeys`, `lockKeys`, `getGroupKey`, `encryptForGroup`, `decryptForGroup`
- Auto-lock after 30 minutes of inactivity
- Group keys cached in memory (Map<string, CryptoKey>)

### Services
- `keyExchangeService.ts`: Share group key with new members
- `keyRotationService.ts`: Manual group key rotation by owner

### Encrypted Content Data Flow
```
SAVE: EditorContent[] → JSON → AES-256-GCM(groupKey) → { ciphertext, iv, version } → Firestore
LOAD: Firestore → { ciphertext, iv, version } → AES-256-GCM(groupKey) → JSON → EditorContent[]
```

### Settings
- Encryption settings at `/settings/security/encryption`

## Dependencies

- Requires `groups` feature flag to be enabled
- Requires `private_pages` feature flag for encryption features
- Requires `groupId` field on page documents (added by Groups feature)
- Access control in `app/firebase/database/access.ts`
- Group membership data in `app/firebase/database/groups.ts`
- Key storage in `app/firebase/database/userKeys.ts`
