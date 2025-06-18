/**
 * Token Earnings Service for WeWrite Writers
 * 
 * Manages token earnings tracking, monthly processing, and payout functionality
 * for content creators who receive token allocations from subscribers.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { WriterTokenEarnings, WriterTokenBalance, TokenPayout, TokenAllocation } from '../types/database';
import { getCurrentMonth, getPreviousMonth } from '../utils/subscriptionTiers';

export class TokenEarningsService {
  
  /**
   * Get writer's token balance (pending + available + paid out)
   */
  static async getWriterTokenBalance(userId: string): Promise<WriterTokenBalance | null> {
    try {
      const balanceRef = doc(db, 'writerTokenBalances', userId);
      const balanceDoc = await getDoc(balanceRef);
      
      if (balanceDoc.exists()) {
        return balanceDoc.data() as WriterTokenBalance;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting writer token balance:', error);
      return null;
    }
  }

  /**
   * Get writer's earnings for a specific month
   */
  static async getWriterEarningsForMonth(userId: string, month: string): Promise<WriterTokenEarnings | null> {
    try {
      const earningsRef = doc(db, 'writerTokenEarnings', `${userId}_${month}`);
      const earningsDoc = await getDoc(earningsRef);
      
      if (earningsDoc.exists()) {
        return earningsDoc.data() as WriterTokenEarnings;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting writer earnings for month:', error);
      return null;
    }
  }

  /**
   * Get writer's earnings history
   */
  static async getWriterEarningsHistory(userId: string, limitCount: number = 12): Promise<WriterTokenEarnings[]> {
    try {
      const earningsQuery = query(
        collection(db, 'writerTokenEarnings'),
        where('userId', '==', userId),
        orderBy('month', 'desc'),
        limit(limitCount)
      );
      
      const earningsSnapshot = await getDocs(earningsQuery);
      return earningsSnapshot.docs.map(doc => doc.data() as WriterTokenEarnings);
    } catch (error) {
      console.error('Error getting writer earnings history:', error);
      return [];
    }
  }

  /**
   * Process monthly token earnings for a writer
   * Called when tokens are allocated to their content
   */
  static async processTokenAllocation(allocation: TokenAllocation): Promise<void> {
    try {
      const { recipientUserId, tokens, month, userId: fromUserId, resourceType, resourceId } = allocation;
      const usdValue = tokens / 10; // $1 = 10 tokens
      
      // Get or create monthly earnings record
      const earningsId = `${recipientUserId}_${month}`;
      const earningsRef = doc(db, 'writerTokenEarnings', earningsId);
      const earningsDoc = await getDoc(earningsRef);
      
      const allocationData = {
        allocationId: allocation.id,
        fromUserId,
        resourceType,
        resourceId,
        tokens,
        usdValue
      };
      
      if (earningsDoc.exists()) {
        // Update existing earnings
        const currentEarnings = earningsDoc.data() as WriterTokenEarnings;
        const updatedAllocations = [...currentEarnings.allocations, allocationData];
        const totalTokens = updatedAllocations.reduce((sum, alloc) => sum + alloc.tokens, 0);
        const totalUsd = totalTokens / 10;
        
        await updateDoc(earningsRef, {
          totalTokensReceived: totalTokens,
          totalUsdValue: totalUsd,
          allocations: updatedAllocations,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new earnings record
        const newEarnings: Omit<WriterTokenEarnings, 'id'> = {
          userId: recipientUserId,
          month,
          totalTokensReceived: tokens,
          totalUsdValue: usdValue,
          status: 'pending',
          allocations: [allocationData],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(earningsRef, {
          id: earningsId,
          ...newEarnings
        });
      }
      
      // Update writer's overall balance
      await this.updateWriterBalance(recipientUserId);
      
    } catch (error) {
      console.error('Error processing token allocation:', error);
      throw error;
    }
  }

  /**
   * Update writer's overall token balance
   */
  static async updateWriterBalance(userId: string): Promise<void> {
    try {
      const currentMonth = getCurrentMonth();
      
      // Get all earnings for this writer
      const earningsQuery = query(
        collection(db, 'writerTokenEarnings'),
        where('userId', '==', userId)
      );
      
      const earningsSnapshot = await getDocs(earningsQuery);
      const allEarnings = earningsSnapshot.docs.map(doc => doc.data() as WriterTokenEarnings);
      
      // Calculate totals
      let totalTokensEarned = 0;
      let totalUsdEarned = 0;
      let pendingTokens = 0;
      let pendingUsdValue = 0;
      let availableTokens = 0;
      let availableUsdValue = 0;
      let paidOutTokens = 0;
      let paidOutUsdValue = 0;
      let lastProcessedMonth = '';
      
      allEarnings.forEach(earnings => {
        totalTokensEarned += earnings.totalTokensReceived;
        totalUsdEarned += earnings.totalUsdValue;
        
        if (earnings.month === currentMonth) {
          // Current month is pending
          pendingTokens += earnings.totalTokensReceived;
          pendingUsdValue += earnings.totalUsdValue;
        } else if (earnings.status === 'available') {
          availableTokens += earnings.totalTokensReceived;
          availableUsdValue += earnings.totalUsdValue;
        } else if (earnings.status === 'paid_out') {
          paidOutTokens += earnings.totalTokensReceived;
          paidOutUsdValue += earnings.totalUsdValue;
        }
        
        if (earnings.month > lastProcessedMonth) {
          lastProcessedMonth = earnings.month;
        }
      });
      
      // Update balance document
      const balanceRef = doc(db, 'writerTokenBalances', userId);
      const balanceData: Omit<WriterTokenBalance, 'createdAt'> = {
        userId,
        totalTokensEarned,
        totalUsdEarned,
        pendingTokens,
        pendingUsdValue,
        availableTokens,
        availableUsdValue,
        paidOutTokens,
        paidOutUsdValue,
        lastProcessedMonth,
        updatedAt: serverTimestamp()
      };
      
      const balanceDoc = await getDoc(balanceRef);
      if (balanceDoc.exists()) {
        await updateDoc(balanceRef, balanceData);
      } else {
        await setDoc(balanceRef, {
          ...balanceData,
          createdAt: serverTimestamp()
        });
      }
      
    } catch (error) {
      console.error('Error updating writer balance:', error);
      throw error;
    }
  }

  /**
   * Process monthly token distribution (move pending to available)
   * Called at the end of each month
   */
  static async processMonthlyDistribution(month: string): Promise<void> {
    try {
      console.log(`Processing monthly token distribution for writers: ${month}`);
      
      // Get all earnings for the specified month
      const earningsQuery = query(
        collection(db, 'writerTokenEarnings'),
        where('month', '==', month),
        where('status', '==', 'pending')
      );
      
      const earningsSnapshot = await getDocs(earningsQuery);
      const batch = writeBatch(db);
      
      // Mark all earnings as available
      earningsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          status: 'available',
          processedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      
      // Update all affected writer balances
      const affectedWriters = new Set<string>();
      earningsSnapshot.docs.forEach(doc => {
        const earnings = doc.data() as WriterTokenEarnings;
        affectedWriters.add(earnings.userId);
      });
      
      for (const writerId of affectedWriters) {
        await this.updateWriterBalance(writerId);
      }
      
      console.log(`Processed ${earningsSnapshot.size} earnings records for ${affectedWriters.size} writers`);
      
    } catch (error) {
      console.error('Error processing monthly distribution:', error);
      throw error;
    }
  }

  /**
   * Request payout for available tokens
   */
  static async requestPayout(userId: string, amount?: number): Promise<{ success: boolean; error?: string; payoutId?: string }> {
    try {
      const balance = await this.getWriterTokenBalance(userId);
      if (!balance) {
        return { success: false, error: 'No token balance found' };
      }
      
      const requestedAmount = amount || balance.availableUsdValue;
      const minimumThreshold = 25; // $25 minimum
      
      if (requestedAmount < minimumThreshold) {
        return { success: false, error: `Minimum payout amount is $${minimumThreshold}` };
      }
      
      if (requestedAmount > balance.availableUsdValue) {
        return { success: false, error: 'Insufficient available balance' };
      }
      
      // Create payout request
      const payoutId = `token_payout_${userId}_${Date.now()}`;
      const tokensToPayOut = Math.floor(requestedAmount * 10); // Convert USD back to tokens
      
      const payout: Omit<TokenPayout, 'id'> = {
        userId,
        amount: requestedAmount,
        tokens: tokensToPayOut,
        currency: 'usd',
        status: 'pending',
        earningsIds: [], // Would need to fetch relevant earnings
        requestedAt: serverTimestamp(),
        minimumThresholdMet: requestedAmount >= minimumThreshold
      };
      
      await setDoc(doc(db, 'tokenPayouts', payoutId), {
        id: payoutId,
        ...payout
      });
      
      return { success: true, payoutId };
      
    } catch (error) {
      console.error('Error requesting payout:', error);
      return { success: false, error: 'Failed to request payout' };
    }
  }

  /**
   * Get payout history for a writer
   */
  static async getPayoutHistory(userId: string, limitCount: number = 10): Promise<TokenPayout[]> {
    try {
      const payoutsQuery = query(
        collection(db, 'tokenPayouts'),
        where('userId', '==', userId),
        orderBy('requestedAt', 'desc'),
        limit(limitCount)
      );
      
      const payoutsSnapshot = await getDocs(payoutsQuery);
      return payoutsSnapshot.docs.map(doc => doc.data() as TokenPayout);
    } catch (error) {
      console.error('Error getting payout history:', error);
      return [];
    }
  }
}
