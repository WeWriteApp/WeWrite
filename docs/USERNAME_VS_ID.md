# Username vs. UUID in replies and attributions

## Definitions
- **Username**: Human-readable handle chosen by the user (e.g., `testuser1`). This is what should be shown in UI and attributions.
- **UUID / userId**: Internal identifier (random-looking string). Never display this in user-facing text.

## Reply flow requirements
- When building reply attributions, always render the **username** (handle), not the UUID.
- The reply creation URL must include `pageUsername` (the handle) and `pageUserId` (internal id) separately.
- On `/new`, the prefilled text uses:
  - `pageUsername` for display (`I agree with [page] by [username]` / `I disagree ...`)
  - `pageUserId` only for link targets and metadata.
- If `pageUsername` is absent, fall back to the current session username; never fall back to userId for display.

## Implementation reminders
- Encode/decode usernames when passing via URL params.
- Keep user-facing strings and link metadata distinct:
  - `userId` → link target
  - `username` → visible label
