"use client";

import { db } from '../firebase/config';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getCollectionName, PAYMENT_COLLECTIONS } from '../utils/environmentConfig';

export interface MonthlyDonorData {
  month: string; // YYYY-MM format
  donorCount: number;
  totalTokens: number;
  uniqueDonors: string[]; // Array of donor user IDs
}

export interface UserDonorStats {
  currentMonthDonors: number;
  totalActiveTokens: number;
  monthlyData: MonthlyDonorData[];
  sparklineData: number[]; // Last 12 months of donor counts
}

export class UserDonorAnalyticsService {
  
  /**
   * Get monthly donor analytics for a specific user
   */
  static async getUserDonorAnalytics(userId: string): Promise<UserDonorStats> {
    try {
      // Get current month in YYYY-MM format
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Generate last 12 months
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      }

      // Query token allocations for this user as recipient
      const allocationsRef = collection(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS));
      const allocationsQuery = query(
        allocationsRef,
        where('recipientUserId', '==', userId),
        where('status', '==', 'active'),
        orderBy('month', 'desc'),
        limit(500) // Reasonable limit for performance
      );

      const allocationsSnapshot = await getDocs(allocationsQuery);
      
      // Group allocations by month
      const monthlyData: Record<string, MonthlyDonorData> = {};
      let currentMonthDonors = 0;
      let totalActiveTokens = 0;

      allocationsSnapshot.forEach(doc => {
        const allocation = doc.data();
        const month = allocation.month;
        const donorId = allocation.userId;
        const tokens = allocation.tokens || 0;

        // Initialize month data if not exists
        if (!monthlyData[month]) {
          monthlyData[month] = {
            month,
            donorCount: 0,
            totalTokens: 0,
            uniqueDonors: []
          };
        }

        // Add donor if not already counted for this month
        if (!monthlyData[month].uniqueDonors.includes(donorId)) {
          monthlyData[month].uniqueDonors.push(donorId);
          monthlyData[month].donorCount++;
        }

        // Add tokens
        monthlyData[month].totalTokens += tokens;

        // Count current month stats
        if (month === currentMonth) {
          if (!monthlyData[currentMonth].uniqueDonors.includes(donorId)) {
            currentMonthDonors++;
          }
          totalActiveTokens += tokens;
        }
      });

      // Create sparkline data for last 12 months
      const sparklineData = months.map(month => {
        return monthlyData[month]?.donorCount || 0;
      });

      // Convert monthly data to array and sort by month
      const monthlyDataArray = Object.values(monthlyData)
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 12); // Last 12 months

      return {
        currentMonthDonors: monthlyData[currentMonth]?.donorCount || 0,
        totalActiveTokens,
        monthlyData: monthlyDataArray,
        sparklineData
      };

    } catch (error) {
      console.error('Error getting user donor analytics:', error);
      return {
        currentMonthDonors: 0,
        totalActiveTokens: 0,
        monthlyData: [],
        sparklineData: Array(12).fill(0)
      };
    }
  }

  /**
   * Get real-time listener for user donor stats (for current month only)
   */
  static listenToCurrentMonthDonors(
    userId: string, 
    callback: (stats: { donorCount: number; totalTokens: number }) => void
  ) {
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const allocationsRef = collection(db, getCollectionName(PAYMENT_COLLECTIONS.TOKEN_ALLOCATIONS));
      const currentMonthQuery = query(
        allocationsRef,
        where('recipientUserId', '==', userId),
        where('month', '==', currentMonth),
        where('status', '==', 'active')
      );

      // Note: Using getDocs instead of onSnapshot for now to avoid real-time costs
      // Can be upgraded to real-time if needed
      const fetchCurrentStats = async () => {
        try {
          const snapshot = await getDocs(currentMonthQuery);
          const uniqueDonors = new Set<string>();
          let totalTokens = 0;

          snapshot.forEach(doc => {
            const allocation = doc.data();
            uniqueDonors.add(allocation.userId);
            totalTokens += allocation.tokens || 0;
          });

          callback({
            donorCount: uniqueDonors.size,
            totalTokens
          });
        } catch (error) {
          console.error('Error fetching current month donor stats:', error);
          callback({ donorCount: 0, totalTokens: 0 });
        }
      };

      // Initial fetch
      fetchCurrentStats();

      // Return a cleanup function (even though we're not using real-time)
      return () => {
        // No cleanup needed for getDocs
      };

    } catch (error) {
      console.error('Error setting up donor stats listener:', error);
      callback({ donorCount: 0, totalTokens: 0 });
      return () => {};
    }
  }
}
