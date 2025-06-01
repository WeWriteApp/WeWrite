"use client";

import { useState, useEffect } from 'react';
import { useSEO } from '../hooks/useSEO';
import { SEOAnalytics, SEOPerformanceChart, SEOIssuesList, SEOScoreBadge, SEOQuickActions } from '../components/seo/SEOAnalytics';
import { SEOProvider } from '../components/seo/SEOProvider';
import { StructuredDataProvider, BreadcrumbSchema } from '../components/seo/StructuredDataProvider';
import { SEOImage, ResponsiveSEOImage, HeroSEOImage } from '../components/seo/SEOImage';
import { SEOLink, CTALink, SocialLink, TagLink } from '../components/seo/SEOLink';

export default function SEOTestPage() {
  const [testResults, setTestResults] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  
  const seoOptions = {
    title: 'SEO Test Page - WeWrite',
    description: 'Comprehensive SEO testing page for WeWrite application with all optimization features.',
    content: 'This is a test page to validate all SEO optimizations including meta tags, structured data, performance monitoring, and accessibility features.',
    author: { name: 'SEO Team', url: '/user/seo-team' },
    tags: ['seo', 'testing', 'optimization', 'wewrite'],
    type: 'webpage',
    enableAutoOptimization: true,
    enablePerformanceTracking: true
  };

  const { 
    seoState, 
    validateSEO, 
    autoOptimize, 
    generateMetaData, 
    getBreadcrumbs,
    isOptimized,
    score,
    issues,
    recommendations 
  } = useSEO(seoOptions);

  useEffect(() => {
    // Generate mock performance data
    const mockData = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
      score: Math.floor(Math.random() * 30) + 70 // 70-100 range
    }));
    setPerformanceData(mockData);
  }, []);

  const handleOptimize = async () => {
    autoOptimize();
    setTimeout(() => {
      validateSEO().then(setTestResults);
    }, 1000);
  };

  const handleValidate = async () => {
    const results = await validateSEO();
    setTestResults(results);
  };

  const handleExport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      seoScore: score,
      isOptimized,
      issues,
      recommendations,
      metaData: generateMetaData(),
      breadcrumbs: getBreadcrumbs()
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const breadcrumbs = [
    { name: 'WeWrite', url: '/' },
    { name: 'SEO Test', url: '/seo-test' }
  ];

  const mockFAQs = [
    {
      question: 'What is SEO optimization?',
      answer: 'SEO optimization is the process of improving your website to increase its visibility in search engine results.'
    },
    {
      question: 'How does WeWrite optimize content for SEO?',
      answer: 'WeWrite automatically generates meta tags, structured data, sitemaps, and optimizes performance for better search rankings.'
    }
  ];

  return (
    <SEOProvider config={{ 
      enablePerformanceMonitoring: true,
      enableHeadingValidation: true,
      enableLazyLoading: true,
      enableFontOptimization: true 
    }}>
      <StructuredDataProvider 
        type="webpage" 
        data={{
          title: seoOptions.title,
          description: seoOptions.description,
          url: typeof window !== 'undefined' ? window.location.href : '',
          authorName: seoOptions.author.name,
          authorUrl: seoOptions.author.url
        }}
      >
        <BreadcrumbSchema breadcrumbs={breadcrumbs} />
        
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
          {/* Hero Section */}
          <HeroSEOImage
            src="/images/seo-hero.jpg"
            alt="SEO Testing Dashboard for WeWrite"
            width={1200}
            height={400}
            overlay={true}
            overlayColor="rgba(0, 0, 0, 0.5)"
          >
            <div style={{ textAlign: 'center', color: 'white' }}>
              <h1 style={{ fontSize: '3em', margin: '0 0 20px 0' }}>
                SEO Test Dashboard
              </h1>
              <p style={{ fontSize: '1.2em', margin: 0 }}>
                Comprehensive SEO testing and validation for WeWrite
              </p>
            </div>
          </HeroSEOImage>

          {/* SEO Score and Quick Actions */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '20px', 
            margin: '30px 0',
            flexWrap: 'wrap'
          }}>
            <SEOScoreBadge score={score} size="large" />
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 10px 0' }}>Current SEO Status</h2>
              <p style={{ margin: 0, color: '#666' }}>
                {isOptimized ? 
                  '✅ Your page is well optimized for search engines!' :
                  '⚠️ Your page needs SEO improvements.'
                }
              </p>
            </div>
          </div>

          <SEOQuickActions
            onOptimize={handleOptimize}
            onValidate={handleValidate}
            onExport={handleExport}
          />

          {/* Performance Chart */}
          <SEOPerformanceChart data={performanceData} />

          {/* Issues and Recommendations */}
          <SEOIssuesList issues={issues} recommendations={recommendations} />

          {/* Content Sections for Testing */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', margin: '40px 0' }}>
            <section>
              <h2>SEO Features Tested</h2>
              <ul>
                <li>✅ Dynamic Meta Tags</li>
                <li>✅ Structured Data (JSON-LD)</li>
                <li>✅ Open Graph & Twitter Cards</li>
                <li>✅ Canonical URLs</li>
                <li>✅ Heading Hierarchy</li>
                <li>✅ Image Optimization</li>
                <li>✅ Mobile Responsiveness</li>
                <li>✅ Performance Monitoring</li>
                <li>✅ Breadcrumb Navigation</li>
                <li>✅ Internal Linking</li>
              </ul>
            </section>

            <section>
              <h2>Test Images</h2>
              <ResponsiveSEOImage
                src="/images/test-image.jpg"
                alt="SEO optimized test image with proper alt text"
                width={400}
                height={300}
                caption="This image demonstrates proper SEO optimization"
                enableSchema={true}
              />
            </section>
          </div>

          {/* Link Testing Section */}
          <section style={{ margin: '40px 0' }}>
            <h2>Link Optimization Testing</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', margin: '20px 0' }}>
              <SEOLink href="/" title="Home page">Internal Link</SEOLink>
              <SEOLink href="https://example.com" external={true}>External Link</SEOLink>
              <CTALink href="/signup" variant="primary">Sign Up Now</CTALink>
              <SocialLink platform="twitter" href="https://twitter.com/wewrite" username="wewrite" />
              <TagLink tag="seo" count={42} />
              <TagLink tag="optimization" count={28} />
            </div>
          </section>

          {/* Heading Hierarchy Test */}
          <section style={{ margin: '40px 0' }}>
            <h2>Heading Hierarchy Test</h2>
            <h3>This is an H3 heading</h3>
            <p>Content under H3 heading for testing hierarchy validation.</p>
            <h4>This is an H4 heading</h4>
            <p>Content under H4 heading to test proper nesting.</p>
            <h3>Another H3 heading</h3>
            <p>More content to validate heading structure.</p>
          </section>

          {/* FAQ Section for Schema Testing */}
          <section style={{ margin: '40px 0' }}>
            <h2>Frequently Asked Questions</h2>
            {mockFAQs.map((faq, index) => (
              <div key={index} style={{ margin: '20px 0', padding: '15px', background: '#f9f9f9', borderRadius: '5px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>{faq.question}</h3>
                <p style={{ margin: 0, color: '#666' }}>{faq.answer}</p>
              </div>
            ))}
          </section>

          {/* Test Results Display */}
          {testResults && (
            <section style={{ 
              margin: '40px 0', 
              padding: '20px', 
              background: '#f0f8ff', 
              borderRadius: '8px',
              border: '1px solid #cce7ff'
            }}>
              <h2>Latest Test Results</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div>
                  <strong>SEO Score:</strong> {testResults.score}/100
                </div>
                <div>
                  <strong>Issues Found:</strong> {testResults.issues.length}
                </div>
                <div>
                  <strong>Recommendations:</strong> {testResults.recommendations.length}
                </div>
                <div>
                  <strong>Status:</strong> {testResults.score >= 80 ? '✅ Optimized' : '⚠️ Needs Work'}
                </div>
              </div>
            </section>
          )}

          {/* Analytics Dashboard */}
          <SEOAnalytics showDebugInfo={true} enableRealTimeTracking={true} />
        </div>
      </StructuredDataProvider>
    </SEOProvider>
  );
}
