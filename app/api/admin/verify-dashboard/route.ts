/**
 * Comprehensive Admin Dashboard Verification Endpoint
 * Tests all data pipelines and components for the admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../../utils/isAdmin';
import { getServerSession } from 'next-auth/next';

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession();
    if (!session?.user?.email || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Admin verification: Running comprehensive dashboard verification...');

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const verificationResults: Record<string, any> = {};

    // Test all verification endpoints
    const verificationEndpoints = [
      { name: 'tokenData', endpoint: '/api/admin/verify-token-data' },
      { name: 'hourlyAggregations', endpoint: '/api/admin/verify-hourly-aggregations' },
      { name: 'subscriptionFunnel', endpoint: '/api/admin/verify-subscription-funnel' },
      { name: 'globalCounters', endpoint: '/api/admin/verify-global-counters' }
    ];

    // Run all verifications in parallel
    const verificationPromises = verificationEndpoints.map(async ({ name, endpoint }) => {
      try {
        console.log(`🔄 Testing ${name}...`);
        
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        });

        if (response.ok) {
          const data = await response.json();
          verificationResults[name] = {
            status: 'success',
            data: data.data,
            endpoint
          };
          console.log(`✅ ${name} verification passed`);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          verificationResults[name] = {
            status: 'error',
            error: errorData.error || `HTTP ${response.status}`,
            endpoint
          };
          console.log(`❌ ${name} verification failed: ${errorData.error}`);
        }
      } catch (error) {
        verificationResults[name] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Network error',
          endpoint
        };
        console.log(`❌ ${name} verification failed: ${error}`);
      }
    });

    await Promise.all(verificationPromises);

    // Test dashboard analytics endpoints
    const analyticsEndpoints = [
      { name: 'dashboardAnalytics', endpoint: '/api/admin/dashboard-analytics?type=all&startDate=2024-01-01&endDate=2024-12-31&granularity=50' },
      { name: 'paymentAnalytics', endpoint: '/api/admin/payment-analytics?type=all&startDate=2024-01-01&endDate=2024-12-31&granularity=50' }
    ];

    const analyticsResults: Record<string, any> = {};

    const analyticsPromises = analyticsEndpoints.map(async ({ name, endpoint }) => {
      try {
        console.log(`🔄 Testing ${name}...`);
        
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        });

        if (response.ok) {
          const data = await response.json();
          analyticsResults[name] = {
            status: 'success',
            hasData: !!data.data,
            dataKeys: data.data ? Object.keys(data.data) : [],
            endpoint
          };
          console.log(`✅ ${name} analytics passed`);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          analyticsResults[name] = {
            status: 'error',
            error: errorData.error || `HTTP ${response.status}`,
            endpoint
          };
          console.log(`❌ ${name} analytics failed: ${errorData.error}`);
        }
      } catch (error) {
        analyticsResults[name] = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Network error',
          endpoint
        };
        console.log(`❌ ${name} analytics failed: ${error}`);
      }
    });

    await Promise.all(analyticsPromises);

    // Calculate overall health scores
    const verificationHealth = {
      total: verificationEndpoints.length,
      passed: Object.values(verificationResults).filter(r => r.status === 'success').length,
      failed: Object.values(verificationResults).filter(r => r.status === 'error').length
    };

    const analyticsHealth = {
      total: analyticsEndpoints.length,
      passed: Object.values(analyticsResults).filter(r => r.status === 'success').length,
      failed: Object.values(analyticsResults).filter(r => r.status === 'error').length
    };

    const overallHealth = {
      verificationScore: (verificationHealth.passed / verificationHealth.total) * 100,
      analyticsScore: (analyticsHealth.passed / analyticsHealth.total) * 100,
      overallScore: ((verificationHealth.passed + analyticsHealth.passed) / (verificationHealth.total + analyticsHealth.total)) * 100
    };

    // Determine overall status
    let overallStatus = 'healthy';
    if (overallHealth.overallScore < 50) {
      overallStatus = 'critical';
    } else if (overallHealth.overallScore < 80) {
      overallStatus = 'warning';
    }

    // Generate recommendations
    const recommendations = [];
    
    if (verificationResults.tokenData?.status === 'error') {
      recommendations.push('Token allocation pipeline needs attention - check Firestore permissions and data integrity');
    }
    
    if (verificationResults.hourlyAggregations?.status === 'error') {
      recommendations.push('Hourly aggregations pipeline is not working - check analytics aggregation service');
    }
    
    if (verificationResults.subscriptionFunnel?.status === 'error') {
      recommendations.push('Subscription funnel tracking is missing - implement analytics events in subscription flow');
    }
    
    if (verificationResults.globalCounters?.status === 'error') {
      recommendations.push('Global counters are not being maintained - check counter update triggers');
    }

    if (analyticsResults.dashboardAnalytics?.status === 'error') {
      recommendations.push('Dashboard analytics API is failing - check data queries and permissions');
    }

    if (analyticsResults.paymentAnalytics?.status === 'error') {
      recommendations.push('Payment analytics API is failing - check payment data collection and aggregation');
    }

    const result = {
      verification: {
        results: verificationResults,
        health: verificationHealth
      },
      analytics: {
        results: analyticsResults,
        health: analyticsHealth
      },
      overall: {
        status: overallStatus,
        health: overallHealth,
        recommendations
      },
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: verificationHealth.total + analyticsHealth.total,
        passedTests: verificationHealth.passed + analyticsHealth.passed,
        failedTests: verificationHealth.failed + analyticsHealth.failed
      }
    };

    console.log('✅ Comprehensive dashboard verification complete:', {
      overallScore: overallHealth.overallScore,
      status: overallStatus,
      passedTests: result.summary.passedTests,
      totalTests: result.summary.totalTests
    });

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error running dashboard verification:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify dashboard'
    }, { status: 500 });
  }
}
