import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermissions } from '../../admin-auth-helper';
import { getFirebaseAdmin } from '../../../firebase/firebaseAdmin';
import { getCollectionName, COLLECTIONS } from '../../../utils/environmentConfig';
import { PLATFORM_FEE_CONFIG } from '../../../config/platformFee';

export async function GET(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    // Get platform fee data from payouts
    // This would typically come from a dedicated platform_fees collection
    // For now, we'll calculate from payout data
    
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    
    // Get payouts from the last 6 months
    const payoutsQuery = db.collection(getCollectionName(COLLECTIONS.TOKEN_PAYOUTS))
      .where('status', '==', 'completed')
      .where('completedAt', '>=', sixMonthsAgo)
      .orderBy('completedAt', 'desc');

    const payoutsSnapshot = await payoutsQuery.get();
    
    // Calculate platform fees by month
    const monthlyData: { [key: string]: { revenue: number, payouts: number } } = {};
    let totalPlatformRevenue = 0;
    let totalPayouts = 0;

    payoutsSnapshot.docs.forEach(doc => {
      const payout = doc.data();
      const completedAt = payout.completedAt?.toDate() || new Date();
      const monthKey = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, '0')}`;

      const payoutAmount = payout.amount || 0;

      // Calculate platform fee correctly:
      // The payout amount is the net amount after platform fee (10%) and Stripe fees
      // To find the gross amount: gross = net / (1 - platform_fee_rate - stripe_fee_rate)
      // For simplicity, we'll estimate Stripe fees at ~0.5% for standard payouts
      const estimatedStripeFeeRate = 0.005; // 0.5%
      const platformFeeRate = PLATFORM_FEE_CONFIG.PERCENTAGE; // 10%
      const totalFeeRate = platformFeeRate + estimatedStripeFeeRate;

      // Calculate gross amount from net payout
      const grossAmount = payoutAmount / (1 - totalFeeRate);

      // Platform fee is 10% of gross amount
      const platformFee = grossAmount * platformFeeRate;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, payouts: 0 };
      }

      monthlyData[monthKey].revenue += platformFee;
      monthlyData[monthKey].payouts += 1;
      totalPlatformRevenue += platformFee;
      totalPayouts += 1;
    });

    // Convert to chart data format
    const chartData = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        payouts: data.payouts
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate current month revenue
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyPlatformRevenue = monthlyData[currentMonth]?.revenue || 0;

    // Calculate growth (compare to previous month)
    const previousMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
    const previousMonthRevenue = monthlyData[previousMonth]?.revenue || 0;
    const platformFeeGrowth = previousMonthRevenue > 0 
      ? ((monthlyPlatformRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : 0;

    // Calculate average fee per payout
    const averageFeePerPayout = totalPayouts > 0 ? totalPlatformRevenue / totalPayouts : 0;

    const stats = {
      totalPlatformRevenue,
      monthlyPlatformRevenue,
      platformFeeGrowth,
      averageFeePerPayout
    };

    return NextResponse.json({
      success: true,
      chartData,
      stats,
      metadata: {
        totalPayouts,
        dataRange: {
          from: sixMonthsAgo.toISOString(),
          to: now.toISOString()
        },
        platformFeePercentage: 7
      }
    });

  } catch (error) {
    console.error('Error fetching platform fee revenue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform fee revenue data' },
      { status: 500 }
    );
  }
}

// Mock data endpoint for development/testing
export async function POST(request: NextRequest) {
  try {
    // Check admin permissions
    const adminCheck = await checkAdminPermissions(request);
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    // Generate mock data for the last 6 months
    const mockData = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Generate realistic mock revenue data
      const baseRevenue = 150 + (Math.random() * 100); // $150-250 base
      const growthFactor = 1 + (0.1 * (5 - i)); // Growth over time
      const revenue = baseRevenue * growthFactor;
      
      mockData.push({
        month,
        revenue: Math.round(revenue * 100) / 100,
        payouts: Math.floor(10 + Math.random() * 20)
      });
    }

    const totalRevenue = mockData.reduce((sum, item) => sum + item.revenue, 0);
    const currentMonthRevenue = mockData[mockData.length - 1]?.revenue || 0;
    const previousMonthRevenue = mockData[mockData.length - 2]?.revenue || 0;
    const growth = previousMonthRevenue > 0 
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : 0;

    const stats = {
      totalPlatformRevenue: totalRevenue,
      monthlyPlatformRevenue: currentMonthRevenue,
      platformFeeGrowth: growth,
      averageFeePerPayout: totalRevenue / mockData.reduce((sum, item) => sum + item.payouts, 0)
    };

    return NextResponse.json({
      success: true,
      chartData: mockData,
      stats,
      metadata: {
        isMockData: true,
        platformFeePercentage: 7
      }
    });

  } catch (error) {
    console.error('Error generating mock platform fee data:', error);
    return NextResponse.json(
      { error: 'Failed to generate mock data' },
      { status: 500 }
    );
  }
}
