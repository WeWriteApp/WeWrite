#!/usr/bin/env node

/**
 * SEO Audit Script for WeWrite
 * 
 * This script performs a comprehensive SEO audit of the WeWrite application
 * and generates a report with recommendations.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../seo-audit-results');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Audit results storage
 */
const auditResults = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  checks: {},
  recommendations: [],
  score: 0
};

/**
 * Check if robots.txt exists and is properly configured
 */
function checkRobotsTxt() {
  console.log('🤖 Checking robots.txt...');
  
  const robotsPath = path.join(__dirname, '../app/robots.ts');
  const publicRobotsPath = path.join(__dirname, '../public/robots.txt');
  
  const checks = {
    robotsFileExists: fs.existsSync(robotsPath),
    publicRobotsExists: fs.existsSync(publicRobotsPath),
    issues: []
  };
  
  if (!checks.robotsFileExists) {
    checks.issues.push('robots.ts file not found in app directory');
  }
  
  if (checks.robotsFileExists) {
    const robotsContent = fs.readFileSync(robotsPath, 'utf8');
    
    // Check for essential directives
    if (!robotsContent.includes('sitemap')) {
      checks.issues.push('robots.ts missing sitemap directive');
    }
    
    if (!robotsContent.includes('disallow')) {
      checks.issues.push('robots.ts missing disallow directives for private areas');
    }
  }
  
  auditResults.checks.robotsTxt = checks;
  
  if (checks.issues.length > 0) {
    auditResults.recommendations.push('Fix robots.txt configuration issues');
  }
}

/**
 * Check sitemap configuration
 */
function checkSitemaps() {
  console.log('🗺️  Checking sitemaps...');
  
  const sitemapPath = path.join(__dirname, '../app/sitemap.ts');
  const sitemapPagesPath = path.join(__dirname, '../app/api/sitemap-pages/route.ts');
  const sitemapUsersPath = path.join(__dirname, '../app/api/sitemap-users/route.ts');
  const sitemapGroupsPath = path.join(__dirname, '../app/api/sitemap-groups/route.ts');
  
  const checks = {
    mainSitemapExists: fs.existsSync(sitemapPath),
    pagesSitemapExists: fs.existsSync(sitemapPagesPath),
    usersSitemapExists: fs.existsSync(sitemapUsersPath),
    groupsSitemapExists: fs.existsSync(sitemapGroupsPath),
    issues: []
  };
  
  if (!checks.mainSitemapExists) {
    checks.issues.push('Main sitemap.ts not found');
  }
  
  if (!checks.pagesSitemapExists) {
    checks.issues.push('Pages sitemap API route not found');
  }
  
  if (!checks.usersSitemapExists) {
    checks.issues.push('Users sitemap API route not found');
  }
  
  if (!checks.groupsSitemapExists) {
    checks.issues.push('Groups sitemap API route not found');
  }
  
  auditResults.checks.sitemaps = checks;
  
  if (checks.issues.length > 0) {
    auditResults.recommendations.push('Implement missing sitemap files');
  }
}

/**
 * Check meta tag implementations
 */
function checkMetaTags() {
  console.log('🏷️  Checking meta tag implementations...');
  
  const layoutPath = path.join(__dirname, '../app/layout.tsx');
  const pageLayoutPath = path.join(__dirname, '../app/[id]/layout.js');
  const userLayoutPath = path.join(__dirname, '../app/user/[id]/layout.js');
  const groupLayoutPath = path.join(__dirname, '../app/group/[id]/layout.js');
  
  const checks = {
    rootLayoutExists: fs.existsSync(layoutPath),
    pageLayoutExists: fs.existsSync(pageLayoutPath),
    userLayoutExists: fs.existsSync(userLayoutPath),
    groupLayoutExists: fs.existsSync(groupLayoutPath),
    issues: []
  };
  
  // Check root layout
  if (checks.rootLayoutExists) {
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    
    if (!layoutContent.includes('openGraph')) {
      checks.issues.push('Root layout missing Open Graph tags');
    }
    
    if (!layoutContent.includes('twitter')) {
      checks.issues.push('Root layout missing Twitter Card tags');
    }
    
    if (!layoutContent.includes('canonical')) {
      checks.issues.push('Root layout missing canonical URL');
    }
  }
  
  // Check page layout
  if (checks.pageLayoutExists) {
    const pageLayoutContent = fs.readFileSync(pageLayoutPath, 'utf8');
    
    if (!pageLayoutContent.includes('generateMetadata')) {
      checks.issues.push('Page layout missing generateMetadata function');
    }
  }
  
  auditResults.checks.metaTags = checks;
  
  if (checks.issues.length > 0) {
    auditResults.recommendations.push('Implement missing meta tag configurations');
  }
}

/**
 * Check structured data implementation
 */
function checkStructuredData() {
  console.log('📊 Checking structured data...');
  
  const schemaUtilPath = path.join(__dirname, '../app/utils/schemaMarkup.js');
  const layoutPath = path.join(__dirname, '../app/layout.tsx');
  
  const checks = {
    schemaUtilExists: fs.existsSync(schemaUtilPath),
    websiteSchemaInLayout: false,
    issues: []
  };
  
  if (!checks.schemaUtilExists) {
    checks.issues.push('Schema markup utility not found');
  } else {
    const schemaContent = fs.readFileSync(schemaUtilPath, 'utf8');
    
    if (!schemaContent.includes('generateArticleSchema')) {
      checks.issues.push('Article schema generator missing');
    }
    
    if (!schemaContent.includes('generatePersonSchema')) {
      checks.issues.push('Person schema generator missing');
    }
    
    if (!schemaContent.includes('generateGroupSchema')) {
      checks.issues.push('Group schema generator missing');
    }
  }
  
  // Check for website schema in layout
  if (fs.existsSync(layoutPath)) {
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    checks.websiteSchemaInLayout = layoutContent.includes("'@type': 'WebSite'") || layoutContent.includes('"@type": "WebSite"');
  }
  
  if (!checks.websiteSchemaInLayout) {
    checks.issues.push('Website schema markup missing from root layout');
  }
  
  auditResults.checks.structuredData = checks;
  
  if (checks.issues.length > 0) {
    auditResults.recommendations.push('Implement comprehensive structured data markup');
  }
}

/**
 * Check SEO utility files
 */
function checkSEOUtilities() {
  console.log('🛠️  Checking SEO utilities...');
  
  const seoUtilsPath = path.join(__dirname, '../app/utils/seoUtils.js');
  const performancePath = path.join(__dirname, '../app/utils/seoPerformance.js');
  const headingPath = path.join(__dirname, '../app/utils/headingHierarchy.js');
  const mobilePath = path.join(__dirname, '../app/utils/mobileOptimization.js');
  
  const checks = {
    seoUtilsExists: fs.existsSync(seoUtilsPath),
    performanceUtilsExists: fs.existsSync(performancePath),
    headingUtilsExists: fs.existsSync(headingPath),
    mobileUtilsExists: fs.existsSync(mobilePath),
    issues: []
  };
  
  if (!checks.seoUtilsExists) {
    checks.issues.push('SEO utilities file missing');
  }
  
  if (!checks.performanceUtilsExists) {
    checks.issues.push('Performance optimization utilities missing');
  }
  
  if (!checks.headingUtilsExists) {
    checks.issues.push('Heading hierarchy utilities missing');
  }
  
  if (!checks.mobileUtilsExists) {
    checks.issues.push('Mobile optimization utilities missing');
  }
  
  auditResults.checks.seoUtilities = checks;
  
  if (checks.issues.length > 0) {
    auditResults.recommendations.push('Implement missing SEO utility functions');
  }
}

/**
 * Check Next.js configuration for SEO
 */
function checkNextConfig() {
  console.log('⚙️  Checking Next.js configuration...');
  
  const nextConfigPath = path.join(__dirname, '../next.config.js');
  
  const checks = {
    configExists: fs.existsSync(nextConfigPath),
    issues: []
  };
  
  if (checks.configExists) {
    const configContent = fs.readFileSync(nextConfigPath, 'utf8');
    
    if (!configContent.includes('headers')) {
      checks.issues.push('Security headers not configured in Next.js config');
    }
    
    // Check for image optimization
    if (!configContent.includes('images')) {
      checks.issues.push('Image optimization not configured');
    }
  } else {
    checks.issues.push('Next.js configuration file not found');
  }
  
  auditResults.checks.nextConfig = checks;
  
  if (checks.issues.length > 0) {
    auditResults.recommendations.push('Optimize Next.js configuration for SEO');
  }
}

/**
 * Calculate overall SEO score
 */
function calculateScore() {
  const totalChecks = Object.keys(auditResults.checks).length;
  let passedChecks = 0;
  
  Object.values(auditResults.checks).forEach(check => {
    if (check.issues && check.issues.length === 0) {
      passedChecks++;
    }
  });
  
  auditResults.score = Math.round((passedChecks / totalChecks) * 100);
}

/**
 * Generate audit report
 */
function generateReport() {
  console.log('📝 Generating audit report...');
  
  const reportPath = path.join(OUTPUT_DIR, `seo-audit-${Date.now()}.json`);
  const htmlReportPath = path.join(OUTPUT_DIR, `seo-audit-${Date.now()}.html`);
  
  // Save JSON report
  fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
  
  // Generate HTML report
  const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WeWrite SEO Audit Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .score { font-size: 2em; color: ${auditResults.score >= 80 ? '#28a745' : auditResults.score >= 60 ? '#ffc107' : '#dc3545'}; }
        .section { margin: 20px 0; }
        .issue { color: #dc3545; }
        .success { color: #28a745; }
        .recommendation { background: #e9ecef; padding: 10px; margin: 5px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>WeWrite SEO Audit Report</h1>
        <p>Generated: ${auditResults.timestamp}</p>
        <p>Base URL: ${auditResults.baseUrl}</p>
        <div class="score">Score: ${auditResults.score}/100</div>
    </div>
    
    <div class="section">
        <h2>Audit Results</h2>
        ${Object.entries(auditResults.checks).map(([key, check]) => `
            <h3>${key}</h3>
            ${check.issues && check.issues.length > 0 ? 
                `<ul>${check.issues.map(issue => `<li class="issue">❌ ${issue}</li>`).join('')}</ul>` :
                `<p class="success">✅ All checks passed</p>`
            }
        `).join('')}
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        ${auditResults.recommendations.map(rec => `<div class="recommendation">💡 ${rec}</div>`).join('')}
    </div>
</body>
</html>
  `;
  
  fs.writeFileSync(htmlReportPath, htmlReport);
  
  console.log(`\n📊 SEO Audit Complete!`);
  console.log(`Score: ${auditResults.score}/100`);
  console.log(`JSON Report: ${reportPath}`);
  console.log(`HTML Report: ${htmlReportPath}`);
  
  if (auditResults.score < 80) {
    console.log(`\n⚠️  SEO Score is below 80. Please review recommendations.`);
  }
}

/**
 * Main audit function
 */
function runAudit() {
  console.log('🔍 Starting WeWrite SEO Audit...\n');
  
  checkRobotsTxt();
  checkSitemaps();
  checkMetaTags();
  checkStructuredData();
  checkSEOUtilities();
  checkNextConfig();
  
  calculateScore();
  generateReport();
}

// Run the audit
runAudit();
