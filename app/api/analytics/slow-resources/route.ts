import { NextRequest, NextResponse } from 'next/server';

interface SlowResourcePayload {
  name: string;
  duration: number;
  transferSize: number;
  initiatorType: string;
  networkInfo: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };
  timestamp: number;
}

/**
 * Slow Resources Analytics Endpoint
 * 
 * Tracks resources that load slowly and impact performance
 * Helps identify optimization opportunities for poor network connections
 */
export async function POST(request: NextRequest) {
  try {
    const payload: SlowResourcePayload = await request.json();
    
    // Validate payload
    if (!payload.name || typeof payload.duration !== 'number') {
      return NextResponse.json(
        { error: 'Invalid resource data' },
        { status: 400 }
      );
    }

    // Analyze the slow resource
    const analysis = analyzeSlowResource(payload);
    
    // Log for monitoring
    console.warn('Slow Resource Detected:', {
      resource: payload.name,
      duration: `${payload.duration.toFixed(0)}ms`,
      size: formatBytes(payload.transferSize),
      type: payload.initiatorType,
      networkType: payload.networkInfo.effectiveType,
      recommendations: analysis.recommendations,
      timestamp: new Date(payload.timestamp).toISOString()});

    return NextResponse.json({
      success: true,
      resource: payload.name,
      analysis});

  } catch (error) {
    console.error('Error processing slow resource:', error);
    return NextResponse.json(
      { error: 'Failed to process slow resource data' },
      { status: 500 }
    );
  }
}

function analyzeSlowResource(payload: SlowResourcePayload) {
  const analysis = {
    severity: getSeverity(payload.duration),
    category: getResourceCategory(payload.name, payload.initiatorType),
    recommendations: [] as string[],
    optimizationPotential: 'medium' as 'low' | 'medium' | 'high'};

  const isSlowConnection = ['slow-2g', '2g', '3g'].includes(payload.networkInfo.effectiveType || '');
  
  // Category-specific recommendations
  switch (analysis.category) {
    case 'javascript':
      analysis.recommendations.push('Consider code splitting this JavaScript bundle');
      analysis.recommendations.push('Implement dynamic imports for non-critical features');
      if (payload.transferSize > 100 * 1024) { // 100KB
        analysis.recommendations.push('Bundle size is large - consider tree shaking');
        analysis.optimizationPotential = 'high';
      }
      break;
      
    case 'css':
      analysis.recommendations.push('Consider inlining critical CSS');
      analysis.recommendations.push('Load non-critical CSS asynchronously');
      break;
      
    case 'image':
      analysis.recommendations.push('Optimize image format (WebP/AVIF)');
      analysis.recommendations.push('Implement responsive images');
      analysis.recommendations.push('Add lazy loading for below-the-fold images');
      if (payload.transferSize > 500 * 1024) { // 500KB
        analysis.optimizationPotential = 'high';
      }
      break;
      
    case 'font':
      analysis.recommendations.push('Preload critical fonts');
      analysis.recommendations.push('Use font-display: swap for better loading');
      analysis.recommendations.push('Consider system fonts for faster loading');
      break;
      
    case 'api':
      analysis.recommendations.push('Optimize API response size');
      analysis.recommendations.push('Implement response caching');
      analysis.recommendations.push('Consider pagination for large datasets');
      break;
      
    default:
      analysis.recommendations.push('Consider lazy loading this resource');
      analysis.recommendations.push('Implement caching strategies');
  }

  // Network-specific recommendations
  if (isSlowConnection) {
    analysis.recommendations.push('Priority: Optimize for slow connections');
    analysis.recommendations.push('Consider progressive loading');
    analysis.recommendations.push('Implement offline fallbacks');
  }

  // Size-based recommendations
  if (payload.transferSize > 1024 * 1024) { // 1MB
    analysis.recommendations.push('Resource is very large - consider compression');
    analysis.optimizationPotential = 'high';
  }

  return analysis;
}

function getSeverity(duration: number): 'low' | 'medium' | 'high' | 'critical' {
  if (duration < 1000) return 'low';
  if (duration < 3000) return 'medium';
  if (duration < 5000) return 'high';
  return 'critical';
}

function getResourceCategory(name: string, initiatorType: string): string {
  const url = name.toLowerCase();
  
  if (url.includes('.js') || initiatorType === 'script') return 'javascript';
  if (url.includes('.css') || initiatorType === 'link') return 'css';
  if (url.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)/) || initiatorType === 'img') return 'image';
  if (url.match(/\.(woff|woff2|ttf|otf)/) || url.includes('fonts')) return 'font';
  if (url.includes('/api/') || initiatorType === 'fetch') return 'api';
  
  return 'other';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// GET endpoint for slow resources summary
export async function GET(request: NextRequest) {
  try {
    // In a real implementation, you would query your analytics database
    const summary = {
      timestamp: new Date().toISOString(),
      slowResources: {
        total: 45,
        byCategory: {
          javascript: 18,
          image: 12,
          css: 8,
          font: 4,
          api: 3},
        bySeverity: {
          critical: 5,
          high: 12,
          medium: 18,
          low: 10},
        topOffenders: [
          {
            name: 'mapbox-gl.js',
            avgDuration: 4200,
            size: '1.47 MB',
            category: 'javascript',
            recommendations: ['Implement dynamic loading', 'Code splitting']},
          {
            name: 'recharts bundle',
            avgDuration: 2800,
            size: '380 KB',
            category: 'javascript',
            recommendations: ['Lazy load charts', 'Tree shaking']},
          {
            name: 'firebase bundle',
            avgDuration: 2400,
            size: '256 KB',
            category: 'javascript',
            recommendations: ['Dynamic imports', 'Feature splitting']},
        ]},
      recommendations: [
        'Implement dynamic loading for Mapbox components',
        'Add lazy loading for chart components',
        'Split Firebase features into separate bundles',
        'Optimize image loading with modern formats',
      ]};

    return NextResponse.json(summary);

  } catch (error) {
    console.error('Error retrieving slow resources:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve slow resources data' },
      { status: 500 }
    );
  }
}