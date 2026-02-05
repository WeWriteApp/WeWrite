# Groups System

## Overview

Groups are collections of pages and users under a single owner. They allow collaborative page management and shared earnings distribution.

- Route: `/g/[slug]` (group landing page), `/groups` (user's groups list)
- Feature-flagged under `groups`, defaulted to **off** globally, **auto-enabled for admins**
- Navigation: appears in mobile toolbar and desktop sidebar when enabled

## Status

**Phase 1 (Groups Foundation)** — Implemented

- Types, Firestore CRUD, API routes, access control, UI components, navigation integration

**Phase 2 (Fund Distribution & Private Enforcement)** — Implemented

- Group earnings service with fund distribution splitting
- Fund distribution API (`/api/groups/[id]/fund-distribution`)
- Fund distribution editor UI (percentage sliders per member)
- Group earnings summary component
- Earnings tab on group page for members
- Private page filtering from home feed, search API, batch page loading
- Private page SSR protection (no SEO content, no metadata leak)
- Private page access control in single page fetch API

**Phases 3-5 (End-to-End Encryption)** — Implemented

- Crypto primitives (AES-256-GCM, RSA-OAEP, PBKDF2)
- User key bundle storage and API routes
- Group key management (generation, wrapping, sharing)
- CryptoContext with auto-lock, key caching
- Encrypted content save/load flow
- Passcode setup, unlock, and recovery UI
- Key exchange and manual key rotation services
- Encryption settings page (`/settings/security/encryption`)
- See [PRIVATE_PAGES_SYSTEM.md](./PRIVATE_PAGES_SYSTEM.md) for encryption details

## Data Model (Firestore)

### `groups` collection

One document per group:

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated document ID |
| `name` | string | Display name of the group |
| `slug` | string | URL-friendly identifier (used in `/g/[slug]`) |
| `description` | string | Short description |
| `visibility` | `"public"` \| `"private"` | Group visibility setting |
| `ownerId` | string | User ID of the group creator |
| `ownerUsername` | string | Username of the creator |
| `memberIds` | string[] | User IDs of all members (including owner) |
| `memberCount` | number | Count of members |
| `pageCount` | number | Count of pages in the group |
| `fundDistribution` | Record<userId, number> | Percentage splits for earnings distribution |
| `encrypted` | boolean | Whether group content is encrypted (Phase 3+) |
| `deleted` | boolean | Soft delete flag |
| `deletedAt` | string | Soft delete timestamp |
| `createdAt` | string | Creation timestamp |
| `updatedAt` | string | Last update timestamp |

### `groups/{groupId}/members/{userId}` subcollection

| Field | Type | Description |
|---|---|---|
| `userId` | string | Member's user ID |
| `username` | string | Member's username |
| `role` | `"owner"` \| `"admin"` \| `"member"` | Member role |
| `joinedAt` | string | When the member joined |

### `groupInvitations` collection

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated document ID |
| `groupId` | string | Target group |
| `groupName` | string | Group name (denormalized) |
| `inviterId` | string | Who sent the invitation |
| `inviterUsername` | string | Inviter's username |
| `inviteeId` | string | Who is invited |
| `inviteeUsername` | string | Invitee's username |
| `status` | `"pending"` \| `"accepted"` \| `"declined"` | Invitation status |
| `createdAt` | string | Creation timestamp |
| `updatedAt` | string | Last update timestamp |

### Page document updates

Fields added to existing `pages` collection documents:

| Field | Type | Description |
|---|---|---|
| `groupId` | string \| undefined | The group this page belongs to |
| `visibility` | `"public"` \| `"private"` \| undefined | Page visibility (set when added to private group) |
| `isPublic` | boolean \| undefined | Legacy public flag |

## Roles

### Owner
The user who created the group. Permissions:
- Add/remove members
- Add/remove pages
- Set fund distribution percentages
- Manage group settings (name, description, visibility)
- Delete the group

### Admin
Promoted by the owner. Permissions:
- Add/remove members (except owner)
- Add/remove pages
- Update group settings

### Member
A user who accepted an invitation. Permissions:
- View group pages (including private ones)
- Add own pages to the group
- Remove own pages from the group

## API Routes (implemented)

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/groups` | Create a new group |
| `GET` | `/api/groups` | List current user's groups |
| `GET` | `/api/groups/[id]` | Get group details + members |
| `PATCH` | `/api/groups/[id]` | Update group settings |
| `DELETE` | `/api/groups/[id]` | Soft-delete a group |
| `GET` | `/api/groups/[id]/members` | List group members |
| `POST` | `/api/groups/[id]/members` | Invite a member |
| `DELETE` | `/api/groups/[id]/members/[userId]` | Remove a member |
| `GET` | `/api/groups/[id]/pages` | List group pages |
| `POST` | `/api/groups/[id]/pages` | Add a page to the group |
| `DELETE` | `/api/groups/[id]/pages/[pageId]` | Remove a page from the group |
| `GET` | `/api/groups/[id]/fund-distribution` | Get fund distribution percentages |
| `PATCH` | `/api/groups/[id]/fund-distribution` | Update fund distribution (owner/admin) |
| `GET` | `/api/groups/invitations` | Get pending invitations for current user |
| `PATCH` | `/api/groups/invitations` | Accept or decline an invitation |

All routes require authentication. Group creation requires the `groups` feature flag.

## UI Pages & Components (implemented)

| File | Description |
|---|---|
| `app/g/[slug]/page.tsx` | Group landing page (SSR + ISR, 60s revalidation) |
| `app/g/[slug]/GroupPageClient.tsx` | Client component with pages/members tabs |
| `app/g/[slug]/settings/page.tsx` | Group settings (owner only) |
| `app/groups/page.tsx` | User's groups list (owned vs joined sections) |
| `app/components/groups/GroupCard.tsx` | Group card with name, badges, member/page counts |
| `app/components/groups/GroupPageList.tsx` | Lists pages in a group |
| `app/components/groups/GroupMemberList.tsx` | Lists members with role badges and remove action |
| `app/components/groups/CreateGroupModal.tsx` | Create group form (AdaptiveModal) |
| `app/components/groups/InviteMemberModal.tsx` | Invite by username (AdaptiveModal) |
| `app/components/groups/GroupInvitationBanner.tsx` | Pending invitation notification banner |

## Navigation Integration

- Desktop sidebar: "Groups" item (icon: Users) appears when feature flag enabled
- Mobile toolbar: "Groups" item in overflow menu when feature flag enabled
- Active state: highlights on `/groups` and `/g/*` routes
- Settings menu: "Groups" section appears between Security and Recently Deleted

## Feature Flag Behavior

- `groups` flag: disabled globally by default
- Auto-enabled for admin users (checked server-side in `/api/feature-flags` route)
- Admin can toggle globally or per-user via `/admin/feature-flags`

## Access Control

### `checkPageAccess()` in `app/firebase/database/access.ts`
- If `page.visibility === 'private'` and `page.groupId` is set, checks group membership
- Non-members get "Page not found" (no information leak about page existence)
- Page owner always has access regardless of group membership

### `canUserEditPage()` in `app/firebase/database/access.ts`
- Page owner can always edit
- Group members can edit group pages (checked via `isGroupMember()`)

## Search & Indexing

- Typesense schema includes `groupId` and `visibility` fields
- Private pages (`visibility: 'private'`) are excluded from Typesense indexing entirely
- Private pages excluded from sitemap generation

## Privacy

### Public groups
- Anyone can view the group page listing and member list
- Individual pages follow their own visibility settings

### Private groups
- Only members can see the group details, pages, and member list
- Private group pages are hidden from search, feed, sitemap, and direct URL access

## Key Behaviors

- A page can belong to at most one group at a time
- Adding a page to a group requires the page author to be a group member
- Removing a page from a group clears `groupId` and `visibility` from the page
- Group owner can invite users; invitees must accept the invitation
- Soft-deleting a group preserves the data but hides it from all queries
