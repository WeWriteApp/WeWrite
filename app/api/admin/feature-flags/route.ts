import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { getUserEmailFromId, getUserIdFromRequest } from '../../auth-helper';
import { isAdminServer } from '../../admin-auth-helper';

type FeatureFlagMap = Record<string, boolean>;

const DEFAULT_FLAGS: FeatureFlagMap = {
  line_numbers: false,
};

const COLLECTION_DEFAULTS = 'featureFlags';
const COLLECTION_OVERRIDES = 'featureFlagOverrides';

async function getDefaultFlags(adminDb: FirebaseFirestore.Firestore): Promise<FeatureFlagMap> {
  try {
    const docRef = adminDb.collection(getCollectionName(COLLECTION_DEFAULTS)).doc('defaults');
    const snap = await docRef.get();

    if (snap.exists) {
      const data = snap.data() as { flags?: FeatureFlagMap };
      return {
        ...DEFAULT_FLAGS,
        ...(data?.flags || {}),
      };
    }

    await docRef.set({ flags: DEFAULT_FLAGS, updatedAt: new Date().toISOString() }, { merge: true });
    return { ...DEFAULT_FLAGS };
  } catch (error) {
    console.error('[Admin FeatureFlags] Failed to load defaults:', error);
    return { ...DEFAULT_FLAGS };
  }
}

async function getUserOverrides(adminDb: FirebaseFirestore.Firestore, userId: string): Promise<FeatureFlagMap> {
  try {
    const docRef = adminDb.collection(getCollectionName(COLLECTION_OVERRIDES)).doc(userId);
    const snap = await docRef.get();

    if (!snap.exists) return {};
    const data = snap.data() as { flags?: FeatureFlagMap };
    return data?.flags || {};
  } catch (error) {
    console.error(`[Admin FeatureFlags] Failed to load overrides for ${userId}:`, error);
    return {};
  }
}

async function assertAdmin(request: NextRequest): Promise<{ ok: boolean; email?: string; status?: number; error?: string }> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const userEmail = await getUserEmailFromId(userId);
  if (!userEmail || !isAdminServer(userEmail)) {
    return { ok: false, status: 403, error: 'Admin access required' };
  }

  return { ok: true, email: userEmail };
}

export async function GET(request: NextRequest) {
  const adminCheck = await assertAdmin(request);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId');
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const [defaults, overrides] = await Promise.all([
      getDefaultFlags(db),
      getUserOverrides(db, targetUserId),
    ]);

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      flags: {
        ...defaults,
        ...overrides,
      },
      defaults,
      overrides,
    });
  } catch (error: any) {
    console.error('[Admin FeatureFlags] GET failed:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch feature flags' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await assertAdmin(request);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  try {
    const { userId, flags } = await request.json();

    if (!userId || typeof flags !== 'object') {
      return NextResponse.json({ error: 'userId and flags are required' }, { status: 400 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const sanitizedFlags: FeatureFlagMap = {};
    Object.entries(flags).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        sanitizedFlags[key] = value;
      }
    });

    const docRef = db.collection(getCollectionName(COLLECTION_OVERRIDES)).doc(userId);
    await docRef.set(
      {
        flags: sanitizedFlags,
        updatedAt: new Date().toISOString(),
        updatedBy: adminCheck.email || 'admin',
      },
      { merge: true }
    );

    const defaults = await getDefaultFlags(db);

    return NextResponse.json({
      success: true,
      userId,
      flags: {
        ...defaults,
        ...sanitizedFlags,
      },
    });
  } catch (error: any) {
    console.error('[Admin FeatureFlags] POST failed:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update feature flags' },
      { status: 500 }
    );
  }
}
