import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { getUserIdFromRequest } from '../auth-helper';
import { checkAdminPermissions } from '../admin-auth-helper';

type FeatureFlagMap = Record<string, boolean>;

const DEFAULT_FLAGS: FeatureFlagMap = {
  line_numbers: false,
  onboarding_tutorial: false,
  ui_labels: false,
  groups: false,
  private_pages: false,
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

    // Seed defaults if missing to avoid repeated fallbacks
    await docRef.set({ flags: DEFAULT_FLAGS, updatedAt: new Date().toISOString() }, { merge: true });
    return { ...DEFAULT_FLAGS };
  } catch (error) {
    console.error('[FeatureFlags] Failed to load defaults:', error);
    return { ...DEFAULT_FLAGS };
  }
}

async function getUserOverrides(
  adminDb: FirebaseFirestore.Firestore,
  userId: string | null
): Promise<FeatureFlagMap> {
  if (!userId) return {};

  try {
    const docRef = adminDb.collection(getCollectionName(COLLECTION_OVERRIDES)).doc(userId);
    const snap = await docRef.get();

    if (!snap.exists) return {};

    const data = snap.data() as { flags?: FeatureFlagMap };
    return data?.flags || {};
  } catch (error) {
    console.error(`[FeatureFlags] Failed to load overrides for ${userId}:`, error);
    return {};
  }
}

export async function GET(request: NextRequest) {
  const summaryRequested = request.nextUrl.searchParams.get('summary') === '1';
  const flagParam = request.nextUrl.searchParams.get('flag') || 'line_numbers';
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    const userId = await getUserIdFromRequest(request);

    if (summaryRequested) {
      const adminCheck = await checkAdminPermissions(request);
      if (!adminCheck.success) {
        return NextResponse.json({ success: false, error: adminCheck.error }, { status: 403 });
      }

      const defaults = await getDefaultFlags(db);
      const usersCol = db.collection(getCollectionName('users'));
      const totalSnap = await usersCol.count().get().catch(async () => {
        const snap = await usersCol.get();
        return { data: () => ({ count: snap.size }) };
      });
      const totalUsers = totalSnap.data().count || 0;

      // Count overrides that explicitly enable the requested flag
      const overridesSnap = await db
        .collection(getCollectionName(COLLECTION_OVERRIDES))
        .where(`flags.${flagParam}`, '==', true)
        .get()
        .catch(() => ({ size: 0 }));
      const overridesEnabled = (overridesSnap as any).size || 0;

      const defaultEnabled = Boolean(defaults[flagParam]);
      const enabledCount = defaultEnabled ? totalUsers : overridesEnabled;

      return NextResponse.json({
        success: true,
        summary: {
          totalUsers,
          enabledCount,
          defaultEnabled,
        },
      });
    }

    const [defaults, overrides] = await Promise.all([
      getDefaultFlags(db),
      getUserOverrides(db, userId),
    ]);

    const mergedFlags: FeatureFlagMap = {
      ...defaults,
      ...overrides,
    };

    // Auto-enable groups and private_pages for admin users
    if (userId) {
      const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();
      if (userDoc.exists && userDoc.data()?.isAdmin === true) {
        mergedFlags.groups = true;
        mergedFlags.private_pages = true;
      }
    }

    return NextResponse.json({
      success: true,
      flags: mergedFlags,
      userId: userId || null,
      source: {
        defaults: getCollectionName(COLLECTION_DEFAULTS),
        overrides: getCollectionName(COLLECTION_OVERRIDES),
      },
    });
  } catch (error: any) {
    console.error('[FeatureFlags] Failed to fetch flags:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch feature flags',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // skipCsrf: admin session + SameSite cookies provide CSRF protection;
    // the client-side CSRF token flow is unreliable across admin pages
    const adminCheck = await checkAdminPermissions(request, { skipCsrf: true });
    if (!adminCheck.success) {
      return NextResponse.json({ success: false, error: adminCheck.error }, { status: 403 });
    }

    const body = await request.json();
    const { flag, enabled, scope, userId: targetUserId } = body || {};

    if (!flag || typeof enabled !== 'boolean' || !scope) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    if (scope === 'global') {
      const docRef = db.collection(getCollectionName(COLLECTION_DEFAULTS)).doc('defaults');
      await docRef.set(
        {
          flags: { [flag]: enabled },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return NextResponse.json({ success: true, scope: 'global', flag, enabled });
    }

    if (scope === 'user') {
      const userId = targetUserId || (await getUserIdFromRequest(request));
      if (!userId) {
        return NextResponse.json({ success: false, error: 'Missing user context' }, { status: 400 });
      }
      const docRef = db.collection(getCollectionName(COLLECTION_OVERRIDES)).doc(userId);
      await docRef.set(
        {
          flags: { [flag]: enabled },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return NextResponse.json({ success: true, scope: 'user', flag, enabled, userId });
    }

    return NextResponse.json({ success: false, error: 'Unknown scope' }, { status: 400 });
  } catch (error: any) {
    console.error('[FeatureFlags] Failed to update flags:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to update feature flags',
      },
      { status: 500 }
    );
  }
}
