/**
 * Username Cooldown Helpers
 *
 * Provides 30-day cooldown logic for username changes:
 * - Users can only change their username once every 30 days
 * - Released usernames are reserved for the original owner for 30 days
 * - After 30 days, reserved usernames become available to everyone
 */

import { getCollectionName } from '../../../utils/environmentConfig';

const COOLDOWN_DAYS = 30;

interface CooldownStatus {
  blocked: boolean;
  nextChangeDate?: string;
  daysRemaining?: number;
  message?: string;
}

interface AvailabilityResult {
  available: boolean;
  error?: string;
  message?: string;
  cooldown?: {
    reservedBy: string;
    daysRemaining: number;
    isOwnUsername: boolean;
  };
}

/**
 * Check if a user is allowed to change their username (30-day cooldown).
 * Queries usernameHistory for the most recent change by this user.
 */
export async function checkCooldownForUser(
  db: FirebaseFirestore.Firestore,
  userId: string
): Promise<CooldownStatus> {
  try {
    const historyQuery = await db
      .collection(getCollectionName('usernameHistory'))
      .where('userId', '==', userId)
      .orderBy('changedAt', 'desc')
      .limit(1)
      .get();

    if (historyQuery.empty) {
      return { blocked: false };
    }

    const lastChange = historyQuery.docs[0].data();
    const changedAt = lastChange.changedAt?.toDate?.() ?? new Date(lastChange.changedAt);
    const now = new Date();
    const diffMs = now.getTime() - changedAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < COOLDOWN_DAYS) {
      const daysRemaining = Math.ceil(COOLDOWN_DAYS - diffDays);
      const nextChangeDate = new Date(changedAt.getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      return {
        blocked: true,
        nextChangeDate: nextChangeDate.toISOString(),
        daysRemaining,
        message: `You can change your username again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
      };
    }

    return { blocked: false };
  } catch (error) {
    // If the index doesn't exist yet or query fails, allow the change
    console.warn('[cooldown] Error checking cooldown, allowing change:', error);
    return { blocked: false };
  }
}

/**
 * Check if a username is available, taking cooldown reservations into account.
 *
 * - If doc doesn't exist -> available
 * - If status === 'active' (or no status) and uid === currentUserId -> available (own username)
 * - If status === 'active' and different uid -> taken
 * - If status === 'reserved' and reservedUntil has passed -> available (clean up expired doc)
 * - If status === 'reserved' and reservedBy === currentUserId -> available (owner reclaiming)
 * - If status === 'reserved' and still in cooldown -> not available
 */
export async function checkAvailabilityWithCooldown(
  db: FirebaseFirestore.Firestore,
  username: string,
  currentUserId: string | null
): Promise<AvailabilityResult> {
  const usernameDocRef = db
    .collection(getCollectionName('usernames'))
    .doc(username.toLowerCase());
  const usernameDoc = await usernameDocRef.get();

  // Also check users collection for someone actively using this username
  const usersQuery = await db
    .collection(getCollectionName('users'))
    .where('username', '==', username)
    .limit(1)
    .get();

  const isActiveInUsers = !usersQuery.empty;
  const activeUserId = isActiveInUsers ? usersQuery.docs[0].id : null;

  // If someone is actively using this username
  if (isActiveInUsers && activeUserId !== currentUserId) {
    return {
      available: false,
      error: 'Username already taken',
      message: 'This username is already taken.',
    };
  }

  // If the current user already has this username, it's "available" (no change needed)
  if (isActiveInUsers && activeUserId === currentUserId) {
    return { available: true };
  }

  // Check the usernames collection for reserved/active docs
  if (!usernameDoc.exists) {
    return { available: true };
  }

  const data = usernameDoc.data()!;
  const status = data.status || 'active';

  if (status === 'active') {
    // Active username doc — check if it belongs to current user
    if (data.uid === currentUserId) {
      return { available: true };
    }
    return {
      available: false,
      error: 'Username already taken',
      message: 'This username is already taken.',
    };
  }

  if (status === 'reserved') {
    const reservedUntil = data.reservedUntil ? new Date(data.reservedUntil) : null;
    const now = new Date();

    // Reservation expired — clean up and allow
    if (reservedUntil && now > reservedUntil) {
      try {
        await usernameDocRef.delete();
      } catch (e) {
        console.warn('[cooldown] Failed to clean up expired reservation:', e);
      }
      return { available: true };
    }

    // Owner reclaiming their own reserved username
    if (data.reservedBy === currentUserId) {
      return {
        available: true,
        cooldown: {
          reservedBy: data.reservedBy,
          daysRemaining: reservedUntil
            ? Math.ceil((reservedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          isOwnUsername: true,
        },
      };
    }

    // Someone else's reservation still active
    const daysRemaining = reservedUntil
      ? Math.ceil((reservedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : COOLDOWN_DAYS;

    return {
      available: false,
      error: 'Username temporarily reserved',
      message: `This username is temporarily reserved and will become available in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
      cooldown: {
        reservedBy: data.reservedBy,
        daysRemaining,
        isOwnUsername: false,
      },
    };
  }

  // Unknown status — treat as unavailable
  return {
    available: false,
    error: 'Username already taken',
    message: 'This username is not available.',
  };
}
