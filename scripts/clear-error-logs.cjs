#!/usr/bin/env node

/**
 * Error Log Cleaner
 * 
 * Safely clears all stored error logs with backup option
 */

const fs = require('fs');
const path = require('path');

class ErrorLogCleaner {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.backupDir = path.join(process.cwd(), '.error-backups');
    this.options = this.parseArguments();
  }

  parseArguments() {
    const args = process.argv.slice(2);
    return {
      backup: !args.includes('--no-backup'),
      force: args.includes('--force'),
      older: args.includes('--older-than') ? args[args.indexOf('--older-than') + 1] : null,
      verbose: args.includes('--verbose'),
    };
  }

  async run() {
    console.log('🧹 Starting error log cleanup...\n');

    try {
      // Show current status
      await this.showCurrentStatus();
      
      // Confirm action unless forced
      if (!this.options.force) {
        await this.confirmAction();
      }
      
      // Create backup if requested
      if (this.options.backup) {
        await this.createBackup();
      }
      
      // Clear logs
      await this.clearLogs();
      
      console.log('\n✅ Error log cleanup completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Error log cleanup failed:', error.message);
      process.exit(1);
    }
  }

  async showCurrentStatus() {
    console.log('📊 Current Error Log Status:');
    
    // Check file-based logs
    if (fs.existsSync(this.logDir)) {
      const logFiles = fs.readdirSync(this.logDir).filter(file => file.endsWith('.json'));
      console.log(`   📄 Log files: ${logFiles.length}`);
      
      let totalErrors = 0;
      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          totalErrors += lines.length;
          
          if (this.options.verbose) {
            console.log(`      ${file}: ${lines.length} errors`);
          }
        } catch (error) {
          console.warn(`      ⚠️  Could not read ${file}`);
        }
      }
      console.log(`   🔢 Total errors in files: ${totalErrors}`);
    } else {
      console.log('   📄 No log directory found');
    }
    
    // Check for localStorage simulation
    console.log('   🌐 Browser localStorage errors would be cleared in browser environment');
    
    console.log('');
  }

  async confirmAction() {
    console.log('⚠️  This will clear all stored error logs.');
    
    if (this.options.backup) {
      console.log('✅ Backup will be created before clearing.');
    } else {
      console.log('❌ No backup will be created (use --backup to create one).');
    }
    
    console.log('\nTo proceed automatically in the future, use --force flag.');
    console.log('Press Ctrl+C to cancel, or press Enter to continue...');
    
    // Wait for user input
    await new Promise((resolve) => {
      process.stdin.once('data', () => resolve());
    });
  }

  async createBackup() {
    console.log('💾 Creating backup of error logs...');
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupSubDir = path.join(this.backupDir, `backup-${timestamp}`);
    fs.mkdirSync(backupSubDir, { recursive: true });
    
    if (fs.existsSync(this.logDir)) {
      const logFiles = fs.readdirSync(this.logDir);
      let backedUpFiles = 0;
      
      for (const file of logFiles) {
        const sourcePath = path.join(this.logDir, file);
        const backupPath = path.join(backupSubDir, file);
        
        try {
          fs.copyFileSync(sourcePath, backupPath);
          backedUpFiles++;
          
          if (this.options.verbose) {
            console.log(`   ✅ Backed up: ${file}`);
          }
        } catch (error) {
          console.warn(`   ⚠️  Failed to backup ${file}: ${error.message}`);
        }
      }
      
      console.log(`✅ Backup created: ${backupSubDir} (${backedUpFiles} files)`);
    } else {
      console.log('ℹ️  No logs to backup');
    }
  }

  async clearLogs() {
    console.log('🧹 Clearing error logs...');
    
    let clearedFiles = 0;
    let clearedErrors = 0;
    
    // Clear file-based logs
    if (fs.existsSync(this.logDir)) {
      const logFiles = fs.readdirSync(this.logDir);
      
      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        
        try {
          // Count errors before deletion
          if (file.endsWith('.json')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            clearedErrors += lines.length;
          }
          
          // Check if we should delete based on age
          if (this.options.older) {
            const stats = fs.statSync(filePath);
            const fileAge = Date.now() - stats.mtime.getTime();
            const olderThanMs = this.parseTimeString(this.options.older);
            
            if (fileAge < olderThanMs) {
              if (this.options.verbose) {
                console.log(`   ⏭️  Skipped (too recent): ${file}`);
              }
              continue;
            }
          }
          
          fs.unlinkSync(filePath);
          clearedFiles++;
          
          if (this.options.verbose) {
            console.log(`   🗑️  Deleted: ${file}`);
          }
        } catch (error) {
          console.warn(`   ⚠️  Failed to delete ${file}: ${error.message}`);
        }
      }
      
      // Remove log directory if empty
      try {
        const remainingFiles = fs.readdirSync(this.logDir);
        if (remainingFiles.length === 0) {
          fs.rmdirSync(this.logDir);
          if (this.options.verbose) {
            console.log('   🗑️  Removed empty log directory');
          }
        }
      } catch (error) {
        // Directory not empty or other error, ignore
      }
    }
    
    console.log(`✅ Cleared ${clearedFiles} log files containing ${clearedErrors} errors`);
    
    // Instructions for browser-based logs
    console.log('\n🌐 To clear browser localStorage errors:');
    console.log('   1. Open browser developer tools');
    console.log('   2. Go to Console tab');
    console.log('   3. Run: clearErrors()');
    console.log('   4. Or run: localStorage.removeItem("app_errors")');
  }

  parseTimeString(timeStr) {
    // Parse time strings like "1d", "2h", "30m"
    const match = timeStr.match(/^(\d+)([dhm])$/);
    if (!match) {
      throw new Error('Invalid time format. Use format like "1d", "2h", "30m"');
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'd': return value * 24 * 60 * 60 * 1000; // days
      case 'h': return value * 60 * 60 * 1000;      // hours
      case 'm': return value * 60 * 1000;           // minutes
      default: throw new Error('Invalid time unit');
    }
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Error Log Cleaner

Usage: node scripts/clear-error-logs.js [options]

Options:
  --backup         Create backup before clearing (default)
  --no-backup      Don't create backup
  --force          Don't ask for confirmation
  --older-than     Only clear logs older than specified time (e.g., "1d", "2h", "30m")
  --verbose        Show detailed output
  --help, -h       Show this help message

Examples:
  node scripts/clear-error-logs.js                    # Clear all logs with backup
  node scripts/clear-error-logs.js --force            # Clear all logs without confirmation
  node scripts/clear-error-logs.js --older-than 1d    # Clear logs older than 1 day
  node scripts/clear-error-logs.js --no-backup --force # Clear all logs without backup or confirmation
`);
  process.exit(0);
}

// Run the error log cleaner
if (require.main === module) {
  const cleaner = new ErrorLogCleaner();
  cleaner.run();
}

module.exports = ErrorLogCleaner;
