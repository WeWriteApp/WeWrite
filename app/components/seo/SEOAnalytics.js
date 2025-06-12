"use client";

import { useEffect, useState } from 'react';
import { useSEO } from '../../hooks/useSEO';

/**
 * SEO Analytics Dashboard Component
 * 
 * @param {Object} props - Component props
 * @param {boolean} props.showDebugInfo - Whether to show debug information
 * @param {boolean} props.enableRealTimeTracking - Enable real-time SEO tracking
 */
export function SEOAnalytics({ showDebugInfo = false, enableRealTimeTracking = true }) {
  const { seoState, validateSEO } = useSEO();
  const [analytics, setAnalytics] = useState({
    pageViews: 0,
    avgTimeOnPage: 0,
    bounceRate: 0,
    searchImpressions: 0,
    clickThroughRate: 0,
    avgPosition: 0
  });

  useEffect(() => {
    if (!enableRealTimeTracking) return;

    // Track page view
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        event_category: 'SEO Analytics',
        seo_score: seoState.score,
        page_optimized: seoState.isOptimized
      });
    }

    // Set up performance monitoring
    const startTime = Date.now();
    
    const handleBeforeUnload = () => {
      const timeOnPage = Date.now() - startTime;
      if (window.gtag) {
        window.gtag('event', 'time_on_page', {
          event_category: 'SEO Analytics',
          value: Math.round(timeOnPage / 1000), // Convert to seconds
          seo_score: seoState.score
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enableRealTimeTracking, seoState.score, seoState.isOptimized]);

  // Mock analytics data (in real implementation, this would come from your analytics service)
  useEffect(() => {
    // Simulate fetching analytics data
    const fetchAnalytics = async () => {
      // This would typically be an API call to your analytics service
      const mockData = {
        pageViews: Math.floor(Math.random() * 1000) + 100,
        avgTimeOnPage: Math.floor(Math.random() * 300) + 60, // 1-5 minutes
        bounceRate: Math.floor(Math.random() * 50) + 25, // 25-75%
        searchImpressions: Math.floor(Math.random() * 5000) + 500,
        clickThroughRate: (Math.random() * 10 + 2).toFixed(2), // 2-12%
        avgPosition: (Math.random() * 20 + 5).toFixed(1) // Position 5-25
      };
      
      setAnalytics(mockData);
    };

    fetchAnalytics();
  }, []);

  if (!showDebugInfo && process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="seo-analytics" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 10000,
      maxWidth: '300px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#4CAF50' }}>
        📊 SEO Analytics
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>SEO Score:</strong> 
        <span style={{ 
          color: seoState.score >= 80 ? '#4CAF50' : seoState.score >= 60 ? '#FF9800' : '#F44336',
          marginLeft: '5px'
        }}>
          {seoState.score}/100
        </span>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <strong>Status:</strong> 
        <span style={{ 
          color: seoState.isOptimized ? '#4CAF50' : '#F44336',
          marginLeft: '5px'
        }}>
          {seoState.isOptimized ? '✅ Optimized' : '❌ Needs Work'}
        </span>
      </div>

      {seoState.issues.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <strong>Issues:</strong> {seoState.issues.length}
        </div>
      )}

      <div style={{ borderTop: '1px solid hsl(var(--border))', paddingTop: '8px', marginTop: '8px' }}>
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          <div>Page Views: {analytics.pageViews.toLocaleString()}</div>
          <div>Avg Time: {Math.floor(analytics.avgTimeOnPage / 60)}m {analytics.avgTimeOnPage % 60}s</div>
          <div>Bounce Rate: {analytics.bounceRate}%</div>
          <div>Search Impressions: {analytics.searchImpressions.toLocaleString()}</div>
          <div>CTR: {analytics.clickThroughRate}%</div>
          <div>Avg Position: {analytics.avgPosition}</div>
        </div>
      </div>

      <button
        onClick={() => validateSEO()}
        style={{
          marginTop: '8px',
          background: '#2196F3',
          color: 'white',
          border: 'none',
          padding: '4px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '11px'
        }}
      >
        🔄 Refresh SEO
      </button>
    </div>
  );
}

/**
 * SEO Performance Chart Component
 */
export function SEOPerformanceChart({ data = [] }) {
  const maxScore = Math.max(...data.map(d => d.score), 100);
  
  return (
    <div style={{ 
      background: '#f5f5f5', 
      padding: '20px', 
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>SEO Performance Trend</h3>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'end', 
        height: '100px',
        gap: '4px'
      }}>
        {data.map((point, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              background: point.score >= 80 ? '#4CAF50' : point.score >= 60 ? '#FF9800' : '#F44336',
              height: `${(point.score / maxScore) * 100}%`,
              minHeight: '2px',
              borderRadius: '2px 2px 0 0',
              position: 'relative'
            }}
            title={`${point.date}: ${point.score}/100`}
          >
            <div style={{
              position: 'absolute',
              bottom: '-20px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '10px',
              color: '#666',
              whiteSpace: 'nowrap'
            }}>
              {point.score}
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ 
        marginTop: '25px', 
        fontSize: '12px', 
        color: '#666',
        textAlign: 'center'
      }}>
        Last {data.length} measurements
      </div>
    </div>
  );
}

/**
 * SEO Issues List Component
 */
export function SEOIssuesList({ issues = [], recommendations = [] }) {
  if (issues.length === 0 && recommendations.length === 0) {
    return (
      <div style={{ 
        background: '#e8f5e8', 
        padding: '15px', 
        borderRadius: '8px',
        color: '#2e7d32'
      }}>
        ✅ No SEO issues found! Your page is well optimized.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      {issues.length > 0 && (
        <div style={{ 
          background: '#ffebee', 
          padding: '15px', 
          borderRadius: '8px',
          marginBottom: '10px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#c62828' }}>
            ⚠️ Issues Found ({issues.length})
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#d32f2f' }}>
            {issues.map((issue, index) => (
              <li key={index} style={{ marginBottom: '5px' }}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {recommendations.length > 0 && (
        <div style={{ 
          background: '#e3f2fd', 
          padding: '15px', 
          borderRadius: '8px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#1565c0' }}>
            💡 Recommendations ({recommendations.length})
          </h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#1976d2' }}>
            {recommendations.map((rec, index) => (
              <li key={index} style={{ marginBottom: '5px' }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * SEO Score Badge Component
 */
export function SEOScoreBadge({ score, size = 'medium' }) {
  const getColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const sizes = {
    small: { width: '40px', height: '40px', fontSize: '12px' },
    medium: { width: '60px', height: '60px', fontSize: '14px' },
    large: { width: '80px', height: '80px', fontSize: '18px' }
  };

  const sizeStyle = sizes[size] || sizes.medium;

  return (
    <div style={{
      ...sizeStyle,
      borderRadius: '50%',
      background: getColor(score),
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
    }}>
      {score}
    </div>
  );
}

/**
 * SEO Quick Actions Component
 */
export function SEOQuickActions({ onOptimize, onValidate, onExport }) {
  return (
    <div style={{ 
      display: 'flex', 
      gap: '10px', 
      marginBottom: '20px',
      flexWrap: 'wrap'
    }}>
      <button
        onClick={onOptimize}
        style={{
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        🚀 Auto-Optimize
      </button>
      
      <button
        onClick={onValidate}
        style={{
          background: '#2196F3',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        🔍 Validate SEO
      </button>
      
      <button
        onClick={onExport}
        style={{
          background: '#FF9800',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        📊 Export Report
      </button>
    </div>
  );
}
