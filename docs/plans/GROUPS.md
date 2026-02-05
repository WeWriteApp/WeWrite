# Groups Roadmap

## Overview
Enable collaborative writing spaces where multiple users can create and edit shared content. Groups have their own page list, membership management, and activity feeds.

**Status**: Behind `groups` feature flag, subscribers only.
**URL Pattern**: `/g/[groupId]` (short URL for easy sharing)

---

## Current State (Orphaned Code)

The codebase has remnants of a partially-implemented groups system:

| Component | Status | Location |
|-----------|--------|----------|
| `groupId` field | Exists but unused | `app/firebase/database/core.ts`, `app/firebase/database/versions.ts` |
| `/group/` route | Does not exist | Referenced in NotificationItem, ActivityCard, etc. |
| Group functions | Dead imports | `getUserGroupMemberships`, `getGroupsData` referenced but don't exist |

### Cleanup Required
1. Remove dead imports for non-existent group functions
2. Update references from `/group/` to `/g/` pattern
3. Wire `groupId` field to actual functionality

---

## User Value

### Public Groups
- **Collaborative writing spaces** - Multiple authors contributing to shared pages
- **Shared knowledge bases** - Teams building internal documentation together
- **Community-driven content** - Interest groups curating content collections

### Private Groups
- **Corporate/team knowledge bases** - Internal documentation not visible to public
- **Sensitive project documentation** - Confidential project notes and planning
- **Premium content communities** - Exclusive content for paying members

---

## Implementation

### Phase 1: Foundation
- Add `groups` feature flag to `DEFAULT_FLAGS`
- Create `groups` Firestore collection with schema
- Add Firestore security rules for groups
- Clean up orphaned group code

### Phase 2: API Routes
- `GET/POST /api/groups` - List and create groups
- `GET/PATCH/DELETE /api/groups/[groupId]` - Group CRUD
- `GET/POST/DELETE /api/groups/[groupId]/members` - Membership
- `GET /api/groups/[groupId]/pages` - Group pages

### Phase 3: UI - Route & Components
- Create `/g/[groupId]` route (layout + page)
- Create group components (header, member list, page list)
- Create modals (create group, invite member)

### Phase 4: Navigation & Integration
- Add "My Groups" section to sidebar
- Handle `groupId` in page creation (`/new?groupId=xxx`)
- Show group badge on group pages

### Phase 5: Private Groups
- Add `isPublic` flag to group model
- Implement invite-only access controls
- Handle private group discovery (visible but locked)

---

## Data Model

### Group Document
Collection: `groups` (and `DEV_groups`)

```typescript
interface Group {
  id: string;
  name: string;
  slug: string;           // URL-friendly unique identifier
  description?: string;
  isPublic: boolean;      // Public vs private group
  createdAt: string;
  createdBy: string;      // User ID of creator
  memberCount: number;
  pageCount: number;
  photoURL?: string;      // Group avatar
}
```

### Group Membership
Subcollection: `groups/{groupId}/members`

```typescript
interface GroupMember {
  id: string;             // Same as userId (document ID)
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  invitedBy?: string;
}
```

### Page Association
```typescript
interface PageData {
  // Existing fields...
  groupId?: string;       // If page belongs to a group
}
```

---

## Firestore Rules

```javascript
// Groups collection
match /groups/{groupId} {
  // Anyone can read public groups
  // Members can read private groups
  allow read: if
    resource.data.isPublic == true ||
    exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));

  // Only subscribers can create groups
  allow create: if isAuthenticated() && isSubscriber();

  // Only admins/owners can update
  allow update: if isGroupAdmin(groupId);

  // Only owner can delete
  allow delete: if isGroupOwner(groupId);

  // Members subcollection
  match /members/{memberId} {
    allow read: if isGroupMember(groupId);
    allow write: if isGroupAdmin(groupId);
  }
}

// Helper functions
function isGroupMember(groupId) {
  return exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
}

function isGroupAdmin(groupId) {
  let member = get(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
  return member != null && member.data.role in ['owner', 'admin'];
}

function isGroupOwner(groupId) {
  let member = get(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
  return member != null && member.data.role == 'owner';
}
```

---

## API Endpoints

### Groups
```typescript
// List groups (user's groups + public groups)
GET /api/groups
// Response: { groups: Group[] }

// Create group
POST /api/groups
// Request: { name, slug, description?, isPublic }
// Response: { group: Group }

// Get group
GET /api/groups/[groupId]
// Response: { group: Group, membership?: GroupMember }

// Update group
PATCH /api/groups/[groupId]
// Request: { name?, description?, isPublic?, photoURL? }
// Response: { group: Group }

// Delete group
DELETE /api/groups/[groupId]
// Response: { success: true }
```

### Members
```typescript
// List members
GET /api/groups/[groupId]/members
// Response: { members: GroupMember[] }

// Invite member
POST /api/groups/[groupId]/members
// Request: { userId, role? }
// Response: { member: GroupMember }

// Remove member
DELETE /api/groups/[groupId]/members/[userId]
// Response: { success: true }
```

### Pages
```typescript
// List group pages
GET /api/groups/[groupId]/pages
// Response: { pages: PageData[] }
```

---

## Route Structure

Following `/u/[username]` pattern:

```
app/g/
├── [groupId]/
│   ├── layout.tsx      # Server component - SEO, metadata
│   └── page.tsx        # Client component - group home
```

---

## UI Components

### New Components
| Component | Purpose |
|-----------|---------|
| `GroupCard.tsx` | Group preview in listings |
| `GroupHeader.tsx` | Group name, description, avatar |
| `GroupMembersList.tsx` | Member list with roles |
| `GroupPagesList.tsx` | Pages in group |
| `CreateGroupModal.tsx` | Create new group form |
| `InviteMemberModal.tsx` | Invite users to group |

### Modified Components
| Component | Change |
|-----------|--------|
| `DesktopSidebar.tsx` | Add "My Groups" section |
| `MobileNav.tsx` | Add groups navigation |
| `/new/page.tsx` | Handle `groupId` query param |
| `ContentPageView.tsx` | Show group badge |

---

## Membership Roles

| Role | Permissions |
|------|-------------|
| `owner` | All permissions, can delete group, can transfer ownership |
| `admin` | Manage members, edit group settings, create/edit pages |
| `member` | Create pages, edit own pages, view all group pages |

---

## Open Questions

1. **What happens to group content when a group is deleted?**
   - Option A: Delete all pages
   - Option B: Transfer to original authors
   - Option C: Convert to private pages
   - **Decision**: TBD

2. **Should groups have their own themes/branding?**
   - Future consideration

3. **How does version history work for group pages?**
   - Track which member made each edit
   - Show in group-level activity feed

4. **How are earnings distributed for group pages?**
   - Option A: Split equally among members
   - Option B: Split based on contribution
   - Option C: Go to page creator only
   - **Decision**: TBD

5. **Can a page belong to multiple groups?**
   - No - single `groupId` field, one group per page

---

## Related Documentation
- [Private Pages Roadmap](./PRIVATE_PAGES.md)
- [CSS Refactoring Plan](./CSS_REFACTORING.md)
- [Current Architecture](../architecture/CURRENT_ARCHITECTURE.md)
