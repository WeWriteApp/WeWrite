/**
 * Group Earnings Service
 *
 * Handles the distribution of earnings for group pages.
 * When a page belongs to a group, allocations to that page are split
 * among group members according to the group's fundDistribution percentages.
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { getCollectionName } from '../utils/environmentConfig';

export interface GroupEarningsRecord {
  groupId: string;
  month: string; // YYYY-MM
  totalAllocationsReceived: number;
  distributions: {
    userId: string;
    percentage: number;
    amount: number;
  }[];
  pageEarnings: {
    pageId: string;
    amount: number;
  }[];
  calculatedAt: Date;
}

/**
 * Get a group's fund distribution percentages.
 * Returns a map of userId -> percentage (0-100).
 */
export async function getGroupFundDistribution(
  groupId: string
): Promise<Record<string, number> | null> {
  try {
    const groupDoc = await getDoc(doc(db, getCollectionName('groups'), groupId));
    if (!groupDoc.exists()) return null;

    const data = groupDoc.data();
    return data.fundDistribution || null;
  } catch (error) {
    console.error('[GroupEarnings] Error fetching fund distribution:', error);
    return null;
  }
}

/**
 * Distribute an allocation amount among group members based on fund distribution.
 * Returns an array of { userId, amount } for each member who should receive earnings.
 */
export function distributeAmongMembers(
  amount: number,
  fundDistribution: Record<string, number>
): { userId: string; amount: number }[] {
  const distributions: { userId: string; amount: number }[] = [];
  let distributed = 0;

  const entries = Object.entries(fundDistribution);
  for (let i = 0; i < entries.length; i++) {
    const [userId, percentage] = entries[i];

    if (i === entries.length - 1) {
      // Last member gets the remainder to avoid rounding issues
      distributions.push({ userId, amount: amount - distributed });
    } else {
      const memberAmount = Math.floor((amount * percentage) / 100);
      distributions.push({ userId, amount: memberAmount });
      distributed += memberAmount;
    }
  }

  return distributions.filter((d) => d.amount > 0);
}

/**
 * Save a group earnings record for a month.
 */
export async function saveGroupEarningsRecord(
  record: GroupEarningsRecord
): Promise<void> {
  try {
    const docId = `${record.groupId}_${record.month}`;
    await setDoc(doc(db, getCollectionName('groupEarnings'), docId), {
      ...record,
      calculatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[GroupEarnings] Error saving earnings record:', error);
  }
}

/**
 * Get group earnings for a specific month.
 */
export async function getGroupEarnings(
  groupId: string,
  month: string
): Promise<GroupEarningsRecord | null> {
  try {
    const docId = `${groupId}_${month}`;
    const earningsDoc = await getDoc(
      doc(db, getCollectionName('groupEarnings'), docId)
    );

    if (!earningsDoc.exists()) return null;

    const data = earningsDoc.data();
    return {
      ...data,
      calculatedAt: data.calculatedAt?.toDate() || new Date(),
    } as GroupEarningsRecord;
  } catch (error) {
    console.error('[GroupEarnings] Error fetching group earnings:', error);
    return null;
  }
}

/**
 * Get all group earnings records for a group (across months).
 */
export async function getGroupEarningsHistory(
  groupId: string
): Promise<GroupEarningsRecord[]> {
  try {
    const q = query(
      collection(db, getCollectionName('groupEarnings')),
      where('groupId', '==', groupId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        calculatedAt: data.calculatedAt?.toDate() || new Date(),
      } as GroupEarningsRecord;
    });
  } catch (error) {
    console.error('[GroupEarnings] Error fetching earnings history:', error);
    return [];
  }
}
