import { NextRequest, NextResponse } from 'next/server';

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

interface NetworkInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface WebVitalsPayload {
  metric: WebVitalsMetric;
  networkInfo: NetworkInfo;
  timestamp: number;
  userAgent: string;
}

/**
 * Web Vitals Analytics Endpoint
 * 
 * Collects Core Web Vitals metrics for performance monitoring
 * Helps identify performance issues on poor network connections
 */
export async function POST(request: NextRequest) {
  try {
    const payload: WebVitalsPayload = await request.json();
    
    // Validate payload
    if (!payload.metric || !payload.metric.name || typeof payload.metric.value !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metric data' },
        { status: 400 }
      );
    }

    // Log metric for analysis
    console.log('Web Vitals Metric:', {
      metric: payload.metric.name,
      value: payload.metric.value,
      rating: payload.metric.rating,
      networkType: payload.networkInfo.effectiveType,
      timestamp: new Date(payload.timestamp).toISOString()});

    // In production, you would send this to your analytics service
    // For now, we'll just log and store basic metrics
    
    // Check for performance budget violations
    const budgetViolations = checkPerformanceBudgets(payload.metric, payload.networkInfo);
    
    if (budgetViolations.length > 0) {
      console.warn('Performance Budget Violations:', budgetViolations);
    }

    // Analyze network-specific performance
    const networkAnalysis = analyzeNetworkPerformance(payload.metric, payload.networkInfo);
    
    return NextResponse.json({
      success: true,
      metric: payload.metric.name,
      value: payload.metric.value,
      rating: payload.metric.rating,
      budgetViolations,
      networkAnalysis});

  } catch (error) {
    console.error('Error processing web vitals metric:', error);
    return NextResponse.json(
      { error: 'Failed to process metric' },
      { status: 500 }
    );
  }
}

function checkPerformanceBudgets(metric: WebVitalsMetric, networkInfo: NetworkInfo) {
  const violations = [];
  
  // Performance budgets (stricter for slow connections)
  const isSlowConnection = ['slow-2g', '2g', '3g'].includes(networkInfo.effectiveType || '');
  
  const budgets = {
    LCP: isSlowConnection ? 3000 : 2500,  // Largest Contentful Paint
    FID: isSlowConnection ? 150 : 100,    // First Input Delay
    CLS: 0.1,                             // Cumulative Layout Shift
    FCP: isSlowConnection ? 2500 : 1800,  // First Contentful Paint
    TTFB: isSlowConnection ? 1200 : 800,  // Time to First Byte
  };

  const budget = budgets[metric.name as keyof typeof budgets];
  
  if (budget && metric.value > budget) {
    violations.push({
      metric: metric.name,
      value: metric.value,
      budget,
      excess: metric.value - budget,
      severity: metric.rating});
  }

  return violations;
}

function analyzeNetworkPerformance(metric: WebVitalsMetric, networkInfo: NetworkInfo) {
  const analysis = {
    networkType: networkInfo.effectiveType || 'unknown',
    isSlowConnection: ['slow-2g', '2g', '3g'].includes(networkInfo.effectiveType || ''),
    recommendations: [] as string[]};

  // Network-specific recommendations
  if (analysis.isSlowConnection) {
    if (metric.name === 'LCP' && metric.value > 3000) {
      analysis.recommendations.push('Consider implementing critical resource preloading');
      analysis.recommendations.push('Optimize images and use modern formats (WebP/AVIF)');
      analysis.recommendations.push('Implement progressive loading for non-critical content');
    }
    
    if (metric.name === 'FID' && metric.value > 150) {
      analysis.recommendations.push('Reduce JavaScript bundle size');
      analysis.recommendations.push('Implement code splitting for heavy features');
      analysis.recommendations.push('Use service worker for caching');
    }
    
    if (metric.name === 'TTFB' && metric.value > 1200) {
      analysis.recommendations.push('Optimize server response times');
      analysis.recommendations.push('Implement CDN caching');
      analysis.recommendations.push('Reduce API response sizes');
    }
  }

  // Data saver mode recommendations
  if (networkInfo.saveData) {
    analysis.recommendations.push('User has data saver enabled - prioritize essential content');
    analysis.recommendations.push('Defer loading of non-critical resources');
    analysis.recommendations.push('Compress images more aggressively');
  }

  return analysis;
}

// GET endpoint for retrieving performance metrics summary
export async function GET(request: NextRequest) {
  try {
    // In a real implementation, you would query your analytics database
    // For now, return mock performance summary
    
    const summary = {
      timestamp: new Date().toISOString(),
      metrics: {
        LCP: {
          p75: 2800,
          p90: 3500,
          p95: 4200,
          rating: 'needs-improvement'},
        FID: {
          p75: 85,
          p90: 120,
          p95: 180,
          rating: 'good'},
        CLS: {
          p75: 0.08,
          p90: 0.12,
          p95: 0.18,
          rating: 'good'}},
      networkBreakdown: {
        '4g': { percentage: 65, avgLCP: 2400 },
        '3g': { percentage: 25, avgLCP: 3800 },
        '2g': { percentage: 8, avgLCP: 5200 },
        'slow-2g': { percentage: 2, avgLCP: 7500 }},
      recommendations: [
        'Implement aggressive code splitting for heavy dependencies',
        'Optimize images with modern formats and responsive sizing',
        'Add service worker caching for better repeat visits',
        'Consider progressive loading for slow connections',
      ]};

    return NextResponse.json(summary);

  } catch (error) {
    console.error('Error retrieving performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 }
    );
  }
}