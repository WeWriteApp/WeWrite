#!/usr/bin/env node

/**
 * Analyze Read Patterns Script
 * 
 * This script analyzes the codebase to identify potential sources of excessive Firebase reads
 * and provides recommendations for optimization.
 */

const fs = require('fs');
const path = require('path');

// Patterns that indicate potential excessive reads
const HIGH_READ_PATTERNS = [
  {
    pattern: /onSnapshot\s*\(/g,
    severity: 'CRITICAL',
    description: 'Real-time Firestore listener',
    recommendation: 'Replace with API polling or disable if not essential'
  },
  {
    pattern: /onValue\s*\(/g,
    severity: 'CRITICAL', 
    description: 'Real-time Database listener',
    recommendation: 'Replace with API polling or disable if not essential'
  },
  {
    pattern: /listenTo\w+/g,
    severity: 'HIGH',
    description: 'Custom listener function',
    recommendation: 'Review and potentially replace with cached API calls'
  },
  {
    pattern: /setInterval\s*\(\s*.*fetch/g,
    severity: 'HIGH',
    description: 'Polling with fetch',
    recommendation: 'Increase interval or implement smart polling'
  },
  {
    pattern: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?fetch/g,
    severity: 'MEDIUM',
    description: 'useEffect with fetch',
    recommendation: 'Ensure proper dependency array and caching'
  },
  {
    pattern: /getDocs\s*\(/g,
    severity: 'MEDIUM',
    description: 'Firestore collection query',
    recommendation: 'Consider caching and pagination'
  },
  {
    pattern: /getDoc\s*\(/g,
    severity: 'LOW',
    description: 'Firestore document read',
    recommendation: 'Consider caching for frequently accessed documents'
  }
];

// Files to analyze
const ANALYZE_PATHS = [
  'app/components',
  'app/hooks',
  'app/services',
  'app/utils',
  'app/providers'
];

// Files to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.next/,
  /\.vercel/,
  /dist/,
  /build/,
  /coverage/,
  /\.test\./,
  /\.spec\./
];

class ReadPatternAnalyzer {
  constructor() {
    this.results = [];
    this.fileCount = 0;
    this.issueCount = 0;
  }

  /**
   * Analyze a single file for read patterns
   */
  analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(process.cwd(), filePath);
      
      this.fileCount++;
      
      for (const patternConfig of HIGH_READ_PATTERNS) {
        const matches = content.match(patternConfig.pattern);
        
        if (matches) {
          this.issueCount++;
          
          // Get line numbers for each match
          const lines = content.split('\n');
          const matchLines = [];
          
          lines.forEach((line, index) => {
            if (patternConfig.pattern.test(line)) {
              matchLines.push({
                lineNumber: index + 1,
                content: line.trim()
              });
            }
          });
          
          this.results.push({
            file: relativePath,
            severity: patternConfig.severity,
            description: patternConfig.description,
            recommendation: patternConfig.recommendation,
            matchCount: matches.length,
            matches: matchLines
          });
        }
      }
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error.message);
    }
  }

  /**
   * Recursively analyze directory
   */
  analyzeDirectory(dirPath) {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        // Skip files matching skip patterns
        if (SKIP_PATTERNS.some(pattern => pattern.test(fullPath))) {
          continue;
        }
        
        if (stat.isDirectory()) {
          this.analyzeDirectory(fullPath);
        } else if (stat.isFile() && (
          fullPath.endsWith('.ts') || 
          fullPath.endsWith('.tsx') || 
          fullPath.endsWith('.js') || 
          fullPath.endsWith('.jsx')
        )) {
          this.analyzeFile(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error analyzing directory ${dirPath}:`, error.message);
    }
  }

  /**
   * Generate analysis report
   */
  generateReport() {
    console.log('\n🔍 FIREBASE READ PATTERN ANALYSIS REPORT');
    console.log('═'.repeat(60));
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Files analyzed: ${this.fileCount}`);
    console.log(`   Issues found: ${this.issueCount}`);
    console.log(`   Files with issues: ${this.results.length}`);
    
    // Group by severity
    const bySeverity = this.results.reduce((acc, result) => {
      acc[result.severity] = (acc[result.severity] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`\n🚨 ISSUES BY SEVERITY:`);
    Object.entries(bySeverity).forEach(([severity, count]) => {
      const icon = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : severity === 'MEDIUM' ? '🟡' : '🟢';
      console.log(`   ${icon} ${severity}: ${count} files`);
    });
    
    // Detailed results
    console.log(`\n📋 DETAILED FINDINGS:`);
    console.log('─'.repeat(60));
    
    // Sort by severity
    const severityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    this.results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    
    this.results.forEach((result, index) => {
      const icon = result.severity === 'CRITICAL' ? '🔴' : result.severity === 'HIGH' ? '🟠' : result.severity === 'MEDIUM' ? '🟡' : '🟢';
      
      console.log(`\n${index + 1}. ${icon} ${result.file}`);
      console.log(`   Issue: ${result.description} (${result.matchCount} occurrences)`);
      console.log(`   Recommendation: ${result.recommendation}`);
      
      if (result.matches.length > 0) {
        console.log(`   Locations:`);
        result.matches.slice(0, 3).forEach(match => {
          console.log(`     Line ${match.lineNumber}: ${match.content}`);
        });
        
        if (result.matches.length > 3) {
          console.log(`     ... and ${result.matches.length - 3} more`);
        }
      }
    });
    
    // Recommendations
    console.log(`\n💡 OPTIMIZATION RECOMMENDATIONS:`);
    console.log('─'.repeat(60));
    
    const criticalCount = bySeverity.CRITICAL || 0;
    const highCount = bySeverity.HIGH || 0;
    
    if (criticalCount > 0) {
      console.log(`\n🔴 IMMEDIATE ACTION REQUIRED (${criticalCount} critical issues):`);
      console.log(`   1. Disable all real-time listeners immediately`);
      console.log(`   2. Replace with API polling or cached data`);
      console.log(`   3. Monitor read count after changes`);
    }
    
    if (highCount > 0) {
      console.log(`\n🟠 HIGH PRIORITY (${highCount} high-priority issues):`);
      console.log(`   1. Review custom listener functions`);
      console.log(`   2. Implement aggressive caching`);
      console.log(`   3. Reduce polling frequency`);
    }
    
    console.log(`\n🔧 GENERAL OPTIMIZATIONS:`);
    console.log(`   1. Implement the ReadOptimizer utility for all data fetching`);
    console.log(`   2. Use API endpoints instead of direct Firebase calls`);
    console.log(`   3. Add cache headers to API responses`);
    console.log(`   4. Implement request deduplication`);
    console.log(`   5. Use pagination for large data sets`);
    
    console.log(`\n📈 MONITORING:`);
    console.log(`   1. Use the ReadOptimizationDashboard to track improvements`);
    console.log(`   2. Set up alerts for read rate > 100/minute`);
    console.log(`   3. Monitor cache hit rates (target > 80%)`);
    console.log(`   4. Track cost savings from optimizations`);
    
    console.log('\n═'.repeat(60));
    console.log('Analysis complete! Address critical issues first.');
  }

  /**
   * Run the complete analysis
   */
  run() {
    console.log('🔍 Starting Firebase read pattern analysis...');
    
    for (const analyzePath of ANALYZE_PATHS) {
      const fullPath = path.join(process.cwd(), analyzePath);
      
      if (fs.existsSync(fullPath)) {
        console.log(`Analyzing ${analyzePath}...`);
        this.analyzeDirectory(fullPath);
      } else {
        console.log(`Skipping ${analyzePath} (not found)`);
      }
    }
    
    this.generateReport();
  }
}

// Run the analysis
const analyzer = new ReadPatternAnalyzer();
analyzer.run();
