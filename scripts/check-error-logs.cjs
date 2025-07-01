#!/usr/bin/env node

/**
 * Error Log Checker
 * 
 * Analyzes and reports on all stored error logs with detailed statistics
 */

const fs = require('fs');
const path = require('path');

class ErrorLogChecker {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.errors = [];
    this.stats = {
      total: 0,
      byType: {},
      bySeverity: {},
      byHour: {},
      byDay: {},
      recent: [],
    };
  }

  async run() {
    console.log('🔍 Checking error logs...\n');

    try {
      // Load errors from files
      await this.loadErrorsFromFiles();
      
      // Load errors from localStorage simulation (if available)
      await this.loadErrorsFromStorage();
      
      // Analyze errors
      this.analyzeErrors();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Failed to check error logs:', error.message);
      process.exit(1);
    }
  }

  async loadErrorsFromFiles() {
    if (!fs.existsSync(this.logDir)) {
      console.log('📁 No log directory found - no file-based errors to check');
      return;
    }

    const logFiles = fs.readdirSync(this.logDir).filter(file => file.endsWith('.json'));
    
    if (logFiles.length === 0) {
      console.log('📄 No error log files found');
      return;
    }

    console.log(`📄 Found ${logFiles.length} error log files`);

    for (const file of logFiles) {
      const filePath = path.join(this.logDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const error = JSON.parse(line);
            this.errors.push(error);
          } catch (parseError) {
            console.warn(`⚠️  Failed to parse error line in ${file}`);
          }
        }
      } catch (readError) {
        console.warn(`⚠️  Failed to read ${file}: ${readError.message}`);
      }
    }
  }

  async loadErrorsFromStorage() {
    // This would be used in a browser environment
    // For Node.js, we'll simulate checking if there would be localStorage errors
    console.log('🌐 Browser localStorage errors would be checked in browser environment');
  }

  analyzeErrors() {
    console.log(`📊 Analyzing ${this.errors.length} errors...\n`);

    this.stats.total = this.errors.length;

    if (this.errors.length === 0) {
      return;
    }

    // Analyze by type
    this.errors.forEach(error => {
      const type = error.type || 'Unknown';
      this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
    });

    // Analyze by severity
    this.errors.forEach(error => {
      const severity = error.severity || 'unknown';
      this.stats.bySeverity[severity] = (this.stats.bySeverity[severity] || 0) + 1;
    });

    // Analyze by time
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    this.errors.forEach(error => {
      const errorDate = new Date(error.timestamp);
      
      // By hour
      if (errorDate > oneHourAgo) {
        const hour = errorDate.getHours();
        this.stats.byHour[hour] = (this.stats.byHour[hour] || 0) + 1;
      }

      // By day
      if (errorDate > oneDayAgo) {
        const day = errorDate.toISOString().split('T')[0];
        this.stats.byDay[day] = (this.stats.byDay[day] || 0) + 1;
      }
    });

    // Get recent errors (last 10)
    this.stats.recent = this.errors
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);
  }

  generateReport() {
    console.log('📋 Error Log Report');
    console.log('==================\n');

    if (this.stats.total === 0) {
      console.log('✅ No errors found! Your application is running cleanly.');
      return;
    }

    // Overall stats
    console.log(`📊 Overall Statistics:`);
    console.log(`   Total Errors: ${this.stats.total}`);
    console.log(`   Last Hour: ${Object.values(this.stats.byHour).reduce((a, b) => a + b, 0)}`);
    console.log(`   Last Day: ${Object.values(this.stats.byDay).reduce((a, b) => a + b, 0)}\n`);

    // By severity
    if (Object.keys(this.stats.bySeverity).length > 0) {
      console.log('🚨 By Severity:');
      Object.entries(this.stats.bySeverity)
        .sort(([,a], [,b]) => b - a)
        .forEach(([severity, count]) => {
          const icon = severity === 'error' ? '🔴' : severity === 'warning' ? '🟡' : '⚪';
          console.log(`   ${icon} ${severity}: ${count}`);
        });
      console.log('');
    }

    // By type
    if (Object.keys(this.stats.byType).length > 0) {
      console.log('📝 By Error Type:');
      Object.entries(this.stats.byType)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10) // Top 10
        .forEach(([type, count]) => {
          console.log(`   • ${type}: ${count}`);
        });
      console.log('');
    }

    // Recent errors
    if (this.stats.recent.length > 0) {
      console.log('🕒 Recent Errors (Last 10):');
      this.stats.recent.forEach((error, index) => {
        const time = new Date(error.timestamp).toLocaleString();
        const type = error.type || 'Unknown';
        const severity = error.severity || 'unknown';
        const severityIcon = severity === 'error' ? '🔴' : severity === 'warning' ? '🟡' : '⚪';
        
        console.log(`   ${index + 1}. ${severityIcon} [${time}] ${type}`);
        
        if (error.details?.message) {
          console.log(`      Message: ${error.details.message}`);
        }
        
        if (error.details?.stack) {
          const firstStackLine = error.details.stack.split('\n')[1];
          if (firstStackLine) {
            console.log(`      Location: ${firstStackLine.trim()}`);
          }
        }
        console.log('');
      });
    }

    // Recommendations
    this.generateRecommendations();

    // Export option
    console.log('💾 Export Options:');
    console.log('   Run "npm run errors:export" to export all errors to a file');
    console.log('   Run "npm run errors:clear" to clear all stored errors\n');
  }

  generateRecommendations() {
    console.log('💡 Recommendations:');

    const errorCount = this.stats.bySeverity.error || 0;
    const warningCount = this.stats.bySeverity.warning || 0;
    const recentErrorCount = Object.values(this.stats.byHour).reduce((a, b) => a + b, 0);

    if (errorCount > 10) {
      console.log('   🔴 HIGH PRIORITY: You have many errors. Focus on fixing the most common error types first.');
    }

    if (recentErrorCount > 5) {
      console.log('   ⚠️  MEDIUM PRIORITY: Recent error activity detected. Monitor your application closely.');
    }

    if (warningCount > 20) {
      console.log('   🟡 LOW PRIORITY: Many warnings detected. Consider addressing them to prevent future errors.');
    }

    // Specific recommendations based on error types
    const commonTypes = Object.entries(this.stats.byType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    commonTypes.forEach(([type, count]) => {
      if (type.includes('Promise Rejection')) {
        console.log('   🔧 Add proper error handling to async functions and promises');
      }
      if (type.includes('Console Error')) {
        console.log('   🔧 Review console.error() calls and add proper error handling');
      }
      if (type.includes('Global Error')) {
        console.log('   🔧 Add try-catch blocks around potentially failing code');
      }
      if (type.includes('Resource Loading')) {
        console.log('   🔧 Check for missing files or network connectivity issues');
      }
    });

    if (this.stats.total === 0) {
      console.log('   ✅ Great! No errors detected. Keep up the good work!');
    }

    console.log('');
  }
}

// Run the error log checker
if (require.main === module) {
  const checker = new ErrorLogChecker();
  checker.run();
}

module.exports = ErrorLogChecker;
