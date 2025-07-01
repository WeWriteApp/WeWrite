#!/usr/bin/env node

/**
 * Test Report Generator
 * 
 * Consolidates test results from all test runners and generates
 * comprehensive HTML and JSON reports with actionable insights.
 */

const fs = require('fs');
const path = require('path');

class TestReportGenerator {
  constructor() {
    this.testResultsDir = path.join(process.cwd(), 'test-results');
    this.reportOutputDir = path.join(process.cwd(), 'test-reports');
    this.consolidatedResults = {
      timestamp: new Date().toISOString(),
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        successRate: 0
      },
      categories: {
        routes: { total: 0, passed: 0, failed: 0, successRate: 0 },
        api: { total: 0, passed: 0, failed: 0, successRate: 0 },
        pages: { total: 0, passed: 0, failed: 0, successRate: 0 },
        integration: { total: 0, passed: 0, failed: 0, successRate: 0 },
        security: { total: 0, passed: 0, failed: 0, successRate: 0 },
        performance: { total: 0, passed: 0, failed: 0, successRate: 0 }
      },
      errors: [],
      warnings: [],
      recommendations: []
    };
  }

  async generate() {
    console.log('📊 Generating consolidated test report...\n');

    try {
      // Ensure output directory exists
      if (!fs.existsSync(this.reportOutputDir)) {
        fs.mkdirSync(this.reportOutputDir, { recursive: true });
      }

      // Collect all test results
      await this.collectTestResults();

      // Calculate summary statistics
      this.calculateSummary();

      // Generate recommendations
      this.generateRecommendations();

      // Generate HTML report
      this.generateHTMLReport();

      // Generate JSON summary
      this.generateJSONSummary();

      console.log('✅ Test report generation completed');
      console.log(`📄 HTML Report: ${path.join(this.reportOutputDir, 'consolidated-report.html')}`);
      console.log(`📄 JSON Summary: ${path.join(this.reportOutputDir, 'test-summary.json')}`);

    } catch (error) {
      console.error('❌ Test report generation failed:', error.message);
      process.exit(1);
    }
  }

  async collectTestResults() {
    console.log('🔍 Collecting test results...');

    const resultFiles = [
      'quick-test-results',
      'comprehensive-test-results',
      'integration-test-results',
      'security-test-results',
      'performance-test-results',
      'live-test-results'
    ];

    for (const resultDir of resultFiles) {
      const fullPath = path.join(this.testResultsDir, resultDir);
      if (fs.existsSync(fullPath)) {
        await this.processResultDirectory(fullPath, resultDir);
      }
    }
  }

  async processResultDirectory(dirPath, category) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(dirPath, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          this.processTestResult(data, category);
        } catch (error) {
          console.warn(`⚠️  Failed to parse ${filePath}: ${error.message}`);
        }
      }
    }
  }

  processTestResult(data, category) {
    if (data.summary) {
      const categoryKey = this.mapCategoryKey(category);
      
      this.consolidatedResults.categories[categoryKey].total += data.summary.total || 0;
      this.consolidatedResults.categories[categoryKey].passed += data.summary.passed || 0;
      this.consolidatedResults.categories[categoryKey].failed += data.summary.failed || 0;

      if (data.summary.errors) {
        this.consolidatedResults.errors.push(...data.summary.errors);
      }

      if (data.summary.warnings) {
        this.consolidatedResults.warnings.push(...data.summary.warnings);
      }
    }
  }

  mapCategoryKey(category) {
    if (category.includes('route') || category.includes('quick') || category.includes('comprehensive')) {
      return 'routes';
    } else if (category.includes('api')) {
      return 'api';
    } else if (category.includes('page')) {
      return 'pages';
    } else if (category.includes('integration') || category.includes('flow')) {
      return 'integration';
    } else if (category.includes('security')) {
      return 'security';
    } else if (category.includes('performance')) {
      return 'performance';
    }
    return 'routes'; // default
  }

  calculateSummary() {
    console.log('📊 Calculating summary statistics...');

    // Calculate category success rates
    Object.keys(this.consolidatedResults.categories).forEach(category => {
      const cat = this.consolidatedResults.categories[category];
      if (cat.total > 0) {
        cat.successRate = ((cat.passed / cat.total) * 100).toFixed(1);
      }
    });

    // Calculate overall summary
    Object.values(this.consolidatedResults.categories).forEach(cat => {
      this.consolidatedResults.summary.total += cat.total;
      this.consolidatedResults.summary.passed += cat.passed;
      this.consolidatedResults.summary.failed += cat.failed;
    });

    if (this.consolidatedResults.summary.total > 0) {
      this.consolidatedResults.summary.successRate = 
        ((this.consolidatedResults.summary.passed / this.consolidatedResults.summary.total) * 100).toFixed(1);
    }
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...');

    const recommendations = [];

    // Check overall success rate
    if (this.consolidatedResults.summary.successRate < 95) {
      recommendations.push({
        type: 'critical',
        title: 'Low Overall Success Rate',
        description: `Overall success rate is ${this.consolidatedResults.summary.successRate}%. Target should be 95%+.`,
        action: 'Review failed tests and fix underlying issues.'
      });
    }

    // Check category-specific issues
    Object.entries(this.consolidatedResults.categories).forEach(([category, data]) => {
      if (data.total > 0 && data.successRate < 90) {
        recommendations.push({
          type: 'warning',
          title: `${category.charAt(0).toUpperCase() + category.slice(1)} Tests Need Attention`,
          description: `${category} tests have ${data.successRate}% success rate.`,
          action: `Focus on improving ${category} test reliability.`
        });
      }
    });

    // Check for security issues
    if (this.consolidatedResults.categories.security.failed > 0) {
      recommendations.push({
        type: 'critical',
        title: 'Security Test Failures',
        description: `${this.consolidatedResults.categories.security.failed} security tests failed.`,
        action: 'Address security vulnerabilities immediately.'
      });
    }

    // Check for performance issues
    if (this.consolidatedResults.categories.performance.failed > 0) {
      recommendations.push({
        type: 'warning',
        title: 'Performance Issues Detected',
        description: `${this.consolidatedResults.categories.performance.failed} performance tests failed.`,
        action: 'Optimize slow endpoints and improve response times.'
      });
    }

    this.consolidatedResults.recommendations = recommendations;
  }

  generateHTMLReport() {
    console.log('🌐 Generating HTML report...');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WeWrite Automated Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .metric.success { border-left-color: #28a745; }
        .metric.warning { border-left-color: #ffc107; }
        .metric.danger { border-left-color: #dc3545; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #6c757d; font-size: 0.9em; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .category-card { background: #f8f9fa; padding: 15px; border-radius: 6px; }
        .progress-bar { background: #e9ecef; height: 8px; border-radius: 4px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .progress-success { background: #28a745; }
        .progress-warning { background: #ffc107; }
        .progress-danger { background: #dc3545; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; }
        .recommendation { margin-bottom: 15px; padding: 10px; border-radius: 4px; }
        .recommendation.critical { background: #f8d7da; border-left: 4px solid #dc3545; }
        .recommendation.warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 WeWrite Automated Test Report</h1>
            <p class="timestamp">Generated: ${this.consolidatedResults.timestamp}</p>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>📊 Overall Summary</h2>
                <div class="summary">
                    <div class="metric ${this.getMetricClass(this.consolidatedResults.summary.successRate)}">
                        <div class="metric-value">${this.consolidatedResults.summary.successRate}%</div>
                        <div class="metric-label">Success Rate</div>
                    </div>
                    <div class="metric success">
                        <div class="metric-value">${this.consolidatedResults.summary.passed}</div>
                        <div class="metric-label">Tests Passed</div>
                    </div>
                    <div class="metric ${this.consolidatedResults.summary.failed > 0 ? 'danger' : 'success'}">
                        <div class="metric-value">${this.consolidatedResults.summary.failed}</div>
                        <div class="metric-label">Tests Failed</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${this.consolidatedResults.summary.total}</div>
                        <div class="metric-label">Total Tests</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>📋 Test Categories</h2>
                <div class="category-grid">
                    ${Object.entries(this.consolidatedResults.categories).map(([category, data]) => `
                        <div class="category-card">
                            <h3>${category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                            <div class="progress-bar">
                                <div class="progress-fill ${this.getProgressClass(data.successRate)}" 
                                     style="width: ${data.successRate}%"></div>
                            </div>
                            <p>${data.passed}/${data.total} passed (${data.successRate}%)</p>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${this.consolidatedResults.recommendations.length > 0 ? `
            <div class="section">
                <h2>💡 Recommendations</h2>
                <div class="recommendations">
                    ${this.consolidatedResults.recommendations.map(rec => `
                        <div class="recommendation ${rec.type}">
                            <h4>${rec.title}</h4>
                            <p>${rec.description}</p>
                            <strong>Action:</strong> ${rec.action}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${this.consolidatedResults.errors.length > 0 ? `
            <div class="section">
                <h2>🚨 Recent Errors</h2>
                <ul>
                    ${this.consolidatedResults.errors.slice(0, 10).map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;

    fs.writeFileSync(path.join(this.reportOutputDir, 'consolidated-report.html'), html);
  }

  generateJSONSummary() {
    console.log('📄 Generating JSON summary...');

    const summary = {
      timestamp: this.consolidatedResults.timestamp,
      overall: this.consolidatedResults.summary,
      routes: this.consolidatedResults.categories.routes,
      api: this.consolidatedResults.categories.api,
      pages: this.consolidatedResults.categories.pages,
      integration: this.consolidatedResults.categories.integration,
      security: this.consolidatedResults.categories.security,
      performance: this.consolidatedResults.categories.performance,
      recommendations: this.consolidatedResults.recommendations.length,
      reportUrl: './consolidated-report.html'
    };

    fs.writeFileSync(
      path.join(this.reportOutputDir, 'test-summary.json'), 
      JSON.stringify(summary, null, 2)
    );
  }

  getMetricClass(successRate) {
    if (successRate >= 95) return 'success';
    if (successRate >= 80) return 'warning';
    return 'danger';
  }

  getProgressClass(successRate) {
    if (successRate >= 95) return 'progress-success';
    if (successRate >= 80) return 'progress-warning';
    return 'progress-danger';
  }
}

// Run the report generator
if (require.main === module) {
  const generator = new TestReportGenerator();
  generator.generate();
}

module.exports = TestReportGenerator;
