/**
 * Compatibility payout service shim.
 * Routes still importing `payoutService` rely on basic recipient/preferences
 * helpers. This implementation keeps those endpoints working while the unified
 * payout pipeline lives in `payoutServiceUnified`.
 */

import { getFirebaseAdmin } from '../firebase/firebaseAdmin';
import { getCollectionName } from '../utils/environmentConfig';

type PayoutPreferences = {
  minimumThreshold?: number;
  currency?: string;
  schedule?: 'weekly' | 'monthly' | 'manual';
  autoPayoutEnabled?: boolean;
  notificationsEnabled?: boolean;
};

const revenueSplitId = (resourceType: string, resourceId: string) =>
  `${resourceType}_${resourceId}`;

export const payoutService = {
  async getPayoutRecipient(userId: string) {
    const admin = getFirebaseAdmin();
    if (!admin) return null;
    const db = admin.firestore();
    const docRef = db.collection(getCollectionName('payoutRecipients')).doc(userId);
    const snap = await docRef.get();
    return snap.exists ? snap.data() : null;
  },

  async createPayoutRecipient(userId: string, stripeConnectedAccountId: string) {
    const admin = getFirebaseAdmin();
    if (!admin) return { success: false, error: 'Admin not available' };
    const db = admin.firestore();
    const docRef = db.collection(getCollectionName('payoutRecipients')).doc(userId);
    await docRef.set({
      userId,
      stripeConnectedAccountId,
      payoutPreferences: {
        minimumThreshold: 25,
        currency: 'usd',
        schedule: 'manual',
        autoPayoutEnabled: false,
        notificationsEnabled: true
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true };
  },

  async updatePayoutPreferences(userId: string, prefs: Partial<PayoutPreferences>) {
    const admin = getFirebaseAdmin();
    if (!admin) return { success: false, error: 'Admin not available' };
    const db = admin.firestore();
    const docRef = db.collection(getCollectionName('payoutRecipients')).doc(userId);
    const snap = await docRef.get();
    if (!snap.exists) return { success: false, error: 'Recipient not found' };
    const existing = snap.data() || {};
    const updated = {
      ...existing.payoutPreferences,
      ...prefs
    };
    await docRef.update({
      payoutPreferences: updated,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, data: { payoutPreferences: updated } };
  },

  async createDefaultRevenueSplit(resourceType: string, resourceId: string, userId: string) {
    const admin = getFirebaseAdmin();
    if (!admin) return { success: false, error: 'Admin not available' };
    const db = admin.firestore();
    const docRef = db.collection(getCollectionName('revenueSplits')).doc(revenueSplitId(resourceType, resourceId));
    await docRef.set({
      resourceType,
      resourceId,
      userId,
      shares: [{ userId, share: 1 }],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { success: true };
  },

  async getRevenueSplit(resourceType: string, resourceId: string) {
    const admin = getFirebaseAdmin();
    if (!admin) return null;
    const db = admin.firestore();
    const snap = await db.collection(getCollectionName('revenueSplits'))
      .doc(revenueSplitId(resourceType, resourceId))
      .get();
    return snap.exists ? snap.data() : null;
  },

  async createRevenueSplit(
    resourceType: string,
    resourceId: string,
    userId: string,
    shares: any[]
  ) {
    const admin = getFirebaseAdmin();
    if (!admin) return { success: false, error: 'Admin not available' };
    const db = admin.firestore();
    await db.collection(getCollectionName('revenueSplits'))
      .doc(revenueSplitId(resourceType, resourceId))
      .set({
        resourceType,
        resourceId,
        userId,
        shares,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    return { success: true };
  },

  async getPayoutConfig() {
    // Basic defaults; extend as needed
    return {
      minPayout: 25,
      currency: 'usd',
      supportedSchedules: ['manual', 'monthly', 'weekly']
    };
  },

  async getEarningsBreakdown(userId: string) {
    // Placeholder breakdown; replace with real aggregation if needed
    return {
      availableCents: 0,
      pendingCents: 0,
      lifetimeCents: 0,
      userId
    };
  }
};
