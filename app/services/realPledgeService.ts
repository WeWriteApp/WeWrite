/**
 * Service for handling real pledge operations with Stripe integration
 */

import { db } from '../firebase/config';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { Pledge, PaymentTransaction, UserEarnings } from '../types/database';

export class RealPledgeService {
  
  /**
   * Get real pledge data for a user
   */
  async getUserPledges(userId: string): Promise<Pledge[]> {
    try {
      const pledgesQuery = query(
        collection(db, 'pledges'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(pledgesQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as Pledge[];
    } catch (error) {
      console.error('Error getting user pledges:', error);
      return [];
    }
  }

  /**
   * Get real pledge data for a specific page/group
   */
  async getResourcePledges(resourceType: 'page' | 'group', resourceId: string): Promise<Pledge[]> {
    try {
      const fieldName = resourceType === 'page' ? 'pageId' : 'groupId';
      const pledgesQuery = query(
        collection(db, 'pledges'),
        where(fieldName, '==', resourceId),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(pledgesQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      })) as Pledge[];
    } catch (error) {
      console.error('Error getting resource pledges:', error);
      return [];
    }
  }

  /**
   * Get user's current pledge to a specific resource
   */
  async getUserPledgeToResource(userId: string, resourceType: 'page' | 'group', resourceId: string): Promise<Pledge | null> {
    try {
      const fieldName = resourceType === 'page' ? 'pageId' : 'groupId';
      const pledgesQuery = query(
        collection(db, 'pledges'),
        where('userId', '==', userId),
        where(fieldName, '==', resourceId),
        where('status', '==', 'active'),
        limit(1)
      );

      const snapshot = await getDocs(pledgesQuery);
      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      } as Pledge;
    } catch (error) {
      console.error('Error getting user pledge to resource:', error);
      return null;
    }
  }

  /**
   * Get real supporter statistics for a resource
   */
  async getSupporterStats(resourceType: 'page' | 'group', resourceId: string): Promise<{
    count: number;
    totalAmount: number;
    averageAmount: number;
  }> {
    try {
      const pledges = await this.getResourcePledges(resourceType, resourceId);
      const uniqueSupporters = new Set(pledges.map(p => p.userId));
      const totalAmount = pledges.reduce((sum, p) => sum + p.amount, 0);
      
      return {
        count: uniqueSupporters.size,
        totalAmount,
        averageAmount: pledges.length > 0 ? totalAmount / pledges.length : 0
      };
    } catch (error) {
      console.error('Error getting supporter stats:', error);
      return { count: 0, totalAmount: 0, averageAmount: 0 };
    }
  }

  /**
   * Listen to real-time supporter statistics
   */
  subscribeSupporterStats(
    resourceType: 'page' | 'group',
    resourceId: string,
    callback: (stats: { count: number; totalAmount: number }) => void
  ): Unsubscribe {
    const fieldName = resourceType === 'page' ? 'pageId' : 'groupId';
    const pledgesQuery = query(
      collection(db, 'pledges'),
      where(fieldName, '==', resourceId),
      where('status', '==', 'active')
    );

    return onSnapshot(pledgesQuery, (snapshot) => {
      const pledges = snapshot.docs.map(doc => doc.data());
      const uniqueSupporters = new Set(pledges.map(p => p.userId));
      const totalAmount = pledges.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      callback({
        count: uniqueSupporters.size,
        totalAmount
      });
    }, (error) => {
      console.error('Error in supporter stats subscription:', error);
      callback({ count: 0, totalAmount: 0 });
    });
  }

  /**
   * Get user's real earnings data
   */
  async getUserEarnings(userId: string): Promise<UserEarnings | null> {
    try {
      const earningsDoc = await getDoc(doc(db, 'userEarnings', userId));
      if (!earningsDoc.exists()) return null;

      const data = earningsDoc.data();
      return {
        id: earningsDoc.id,
        ...data,
        lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || data.lastUpdated
      } as UserEarnings;
    } catch (error) {
      console.error('Error getting user earnings:', error);
      return null;
    }
  }

  /**
   * Get user's recent payment transactions
   */
  async getUserTransactions(userId: string, asRecipient: boolean = false): Promise<PaymentTransaction[]> {
    try {
      const fieldName = asRecipient ? 'recipientUserId' : 'userId';
      const transactionsQuery = query(
        collection(db, 'paymentTransactions'),
        where(fieldName, '==', userId),
        where('status', '==', 'completed'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(transactionsQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        processedAt: doc.data().processedAt?.toDate?.()?.toISOString() || doc.data().processedAt
      })) as PaymentTransaction[];
    } catch (error) {
      console.error('Error getting user transactions:', error);
      return [];
    }
  }

  /**
   * Cancel a pledge
   */
  async cancelPledge(pledgeId: string, userId: string): Promise<boolean> {
    try {
      const pledgeRef = doc(db, 'pledges', pledgeId);
      const pledgeDoc = await getDoc(pledgeRef);
      
      if (!pledgeDoc.exists()) {
        throw new Error('Pledge not found');
      }

      const pledgeData = pledgeDoc.data();
      
      // Verify user owns this pledge
      if (pledgeData.userId !== userId) {
        throw new Error('Unauthorized to cancel this pledge');
      }

      // Update pledge status
      await updateDoc(pledgeRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });

      // Update resource statistics
      const batch = writeBatch(db);
      
      if (pledgeData.pageId) {
        const pageRef = doc(db, 'pages', pledgeData.pageId);
        batch.update(pageRef, {
          totalPledged: increment(-pledgeData.amount),
          pledgeCount: increment(-1)
        });
      }
      
      if (pledgeData.groupId) {
        const groupRef = doc(db, 'groups', pledgeData.groupId);
        batch.update(groupRef, {
          totalPledged: increment(-pledgeData.amount),
          pledgeCount: increment(-1)
        });
      }

      // Update user statistics
      const userRef = doc(db, 'users', userId);
      batch.update(userRef, {
        totalPledged: increment(-pledgeData.amount),
        activePledges: increment(-1)
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error cancelling pledge:', error);
      return false;
    }
  }

  /**
   * Get monthly earnings breakdown for a user
   */
  async getMonthlyEarnings(userId: string, period?: string): Promise<{
    totalEarnings: number;
    platformFees: number;
    netEarnings: number;
    transactionCount: number;
    transactions: PaymentTransaction[];
  }> {
    try {
      const targetPeriod = period || new Date().toISOString().slice(0, 7);
      
      const transactionsQuery = query(
        collection(db, 'paymentTransactions'),
        where('recipientUserId', '==', userId),
        where('status', '==', 'completed'),
        where('metadata.period', '==', targetPeriod)
      );

      const snapshot = await getDocs(transactionsQuery);
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        processedAt: doc.data().processedAt?.toDate?.()?.toISOString() || doc.data().processedAt
      })) as PaymentTransaction[];

      const totalEarnings = transactions.reduce((sum, txn) => sum + txn.amount, 0);
      const platformFees = transactions.reduce((sum, txn) => sum + txn.platformFee, 0);
      const netEarnings = transactions.reduce((sum, txn) => sum + txn.netAmount, 0);

      return {
        totalEarnings,
        platformFees,
        netEarnings,
        transactionCount: transactions.length,
        transactions
      };
    } catch (error) {
      console.error('Error getting monthly earnings:', error);
      return {
        totalEarnings: 0,
        platformFees: 0,
        netEarnings: 0,
        transactionCount: 0,
        transactions: []
      };
    }
  }
}

// Export singleton instance
export const realPledgeService = new RealPledgeService();
