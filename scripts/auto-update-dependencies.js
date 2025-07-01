#!/usr/bin/env node

/**
 * Automated Dependency Update Script
 * 
 * Safely updates dependencies with comprehensive testing and rollback capabilities:
 * - Checks for outdated packages
 * - Updates dependencies incrementally
 * - Runs tests after each update
 * - Provides rollback on failures
 * - Generates update reports
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DependencyUpdater {
  constructor() {
    this.projectRoot = path.dirname(__dirname);
    this.packageJsonPath = path.join(this.projectRoot, 'package.json');
    this.backupPath = path.join(this.projectRoot, 'package.json.backup');
    this.lockfilePath = path.join(this.projectRoot, 'package-lock.json');
    this.lockfileBackupPath = path.join(this.projectRoot, 'package-lock.json.backup');
    
    this.updates = [];
    this.failures = [];
    this.stats = {
      checked: 0,
      updated: 0,
      failed: 0,
      skipped: 0
    };
    
    this.dryRun = process.argv.includes('--dry-run');
    this.force = process.argv.includes('--force');
    this.verbose = process.argv.includes('--verbose');
    this.majorUpdates = process.argv.includes('--major');
  }

  async run() {
    console.log(`🔄 ${this.dryRun ? 'Checking' : 'Updating'} dependencies...\n`);
    
    try {
      // Create backups
      await this.createBackups();
      
      // Check for outdated packages
      const outdated = await this.getOutdatedPackages();
      
      if (outdated.length === 0) {
        console.log('✅ All dependencies are up to date!');
        return;
      }
      
      // Filter and prioritize updates
      const updates = this.prioritizeUpdates(outdated);
      
      // Apply updates
      if (!this.dryRun) {
        await this.applyUpdates(updates);
      } else {
        this.previewUpdates(updates);
      }
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Update process failed:', error.message);
      
      if (!this.dryRun) {
        await this.rollback();
      }
      
      process.exit(1);
    }
  }

  async createBackups() {
    if (this.dryRun) return;
    
    console.log('💾 Creating backups...');
    
    // Backup package.json
    fs.copyFileSync(this.packageJsonPath, this.backupPath);
    
    // Backup package-lock.json if it exists
    if (fs.existsSync(this.lockfilePath)) {
      fs.copyFileSync(this.lockfilePath, this.lockfileBackupPath);
    }
    
    console.log('   ✅ Backups created');
  }

  async getOutdatedPackages() {
    console.log('🔍 Checking for outdated packages...');
    
    try {
      const output = execSync('npm outdated --json', { 
        cwd: this.projectRoot,
        encoding: 'utf8'
      });
      
      const outdated = JSON.parse(output);
      const packages = Object.entries(outdated).map(([name, info]) => ({
        name,
        current: info.current,
        wanted: info.wanted,
        latest: info.latest,
        type: info.type || 'dependencies'
      }));
      
      this.stats.checked = packages.length;
      console.log(`   Found ${packages.length} outdated packages`);
      
      return packages;
      
    } catch (error) {
      // npm outdated exits with code 1 when packages are outdated
      if (error.stdout) {
        try {
          const outdated = JSON.parse(error.stdout);
          const packages = Object.entries(outdated).map(([name, info]) => ({
            name,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest,
            type: info.type || 'dependencies'
          }));
          
          this.stats.checked = packages.length;
          console.log(`   Found ${packages.length} outdated packages`);
          
          return packages;
        } catch (parseError) {
          console.warn('   Could not parse outdated packages output');
          return [];
        }
      }
      
      console.warn('   No outdated packages found or error checking');
      return [];
    }
  }

  prioritizeUpdates(packages) {
    console.log('📋 Prioritizing updates...');
    
    const updates = packages.map(pkg => {
      const currentVersion = pkg.current;
      const wantedVersion = pkg.wanted;
      const latestVersion = pkg.latest;
      
      // Determine update type
      const updateType = this.getUpdateType(currentVersion, wantedVersion, latestVersion);
      
      // Calculate risk score
      const riskScore = this.calculateRiskScore(pkg, updateType);
      
      return {
        ...pkg,
        updateType,
        riskScore,
        targetVersion: this.majorUpdates ? latestVersion : wantedVersion
      };
    });
    
    // Filter based on settings
    const filtered = updates.filter(update => {
      // Skip major updates unless explicitly requested
      if (update.updateType === 'major' && !this.majorUpdates && !this.force) {
        this.stats.skipped++;
        return false;
      }
      
      // Skip high-risk updates unless forced
      if (update.riskScore > 7 && !this.force) {
        this.stats.skipped++;
        return false;
      }
      
      return true;
    });
    
    // Sort by risk score (lowest first)
    filtered.sort((a, b) => a.riskScore - b.riskScore);
    
    console.log(`   Prioritized ${filtered.length} updates (${this.stats.skipped} skipped)`);
    
    return filtered;
  }

  getUpdateType(current, wanted, latest) {
    const currentParts = current.split('.').map(Number);
    const wantedParts = wanted.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    
    if (latestParts[0] > currentParts[0]) {
      return 'major';
    } else if (latestParts[1] > currentParts[1]) {
      return 'minor';
    } else {
      return 'patch';
    }
  }

  calculateRiskScore(pkg, updateType) {
    let score = 0;
    
    // Base score by update type
    switch (updateType) {
      case 'patch': score += 1; break;
      case 'minor': score += 3; break;
      case 'major': score += 7; break;
    }
    
    // Critical packages get higher risk
    const criticalPackages = [
      'react', 'react-dom', 'next', 'typescript',
      '@types/react', '@types/react-dom', '@types/node'
    ];
    
    if (criticalPackages.includes(pkg.name)) {
      score += 3;
    }
    
    // Development dependencies are lower risk
    if (pkg.type === 'devDependencies') {
      score -= 1;
    }
    
    return Math.max(0, Math.min(10, score));
  }

  async applyUpdates(updates) {
    console.log(`🔄 Applying ${updates.length} updates...\n`);
    
    for (const update of updates) {
      try {
        console.log(`📦 Updating ${update.name}: ${update.current} → ${update.targetVersion}`);
        
        // Install the update
        const installCommand = `npm install ${update.name}@${update.targetVersion}`;
        execSync(installCommand, { 
          cwd: this.projectRoot,
          stdio: this.verbose ? 'inherit' : 'pipe'
        });
        
        // Run tests to verify the update
        const testResult = await this.runTests();
        
        if (testResult.success) {
          console.log(`   ✅ Updated successfully`);
          this.updates.push(update);
          this.stats.updated++;
        } else {
          console.log(`   ❌ Tests failed, rolling back...`);
          await this.rollbackSingleUpdate(update);
          this.failures.push({
            ...update,
            error: testResult.error
          });
          this.stats.failed++;
        }
        
      } catch (error) {
        console.log(`   ❌ Update failed: ${error.message}`);
        this.failures.push({
          ...update,
          error: error.message
        });
        this.stats.failed++;
      }
      
      console.log(''); // Empty line for readability
    }
  }

  async runTests() {
    try {
      console.log('   🧪 Running tests...');
      
      // Run TypeScript compilation
      execSync('npx tsc --noEmit', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      // Run linting
      execSync('npm run lint', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      // Run dependency validation
      execSync('npm run deps:validate', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      // Try to build
      execSync('npm run build', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      return { success: true };
      
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  async rollbackSingleUpdate(update) {
    try {
      const rollbackCommand = `npm install ${update.name}@${update.current}`;
      execSync(rollbackCommand, { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
    } catch (error) {
      console.warn(`   ⚠️  Could not rollback ${update.name}: ${error.message}`);
    }
  }

  async rollback() {
    console.log('🔄 Rolling back changes...');
    
    try {
      // Restore package.json
      if (fs.existsSync(this.backupPath)) {
        fs.copyFileSync(this.backupPath, this.packageJsonPath);
        fs.unlinkSync(this.backupPath);
      }
      
      // Restore package-lock.json
      if (fs.existsSync(this.lockfileBackupPath)) {
        fs.copyFileSync(this.lockfileBackupPath, this.lockfilePath);
        fs.unlinkSync(this.lockfileBackupPath);
      }
      
      // Reinstall dependencies
      execSync('npm install', { 
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
      
      console.log('✅ Rollback completed');
      
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
    }
  }

  previewUpdates(updates) {
    console.log('📋 PREVIEW MODE - No changes will be made\n');
    
    updates.forEach(update => {
      const riskLevel = update.riskScore <= 3 ? 'LOW' : 
                      update.riskScore <= 6 ? 'MEDIUM' : 'HIGH';
      
      console.log(`📦 ${update.name}`);
      console.log(`   Current: ${update.current}`);
      console.log(`   Target:  ${update.targetVersion}`);
      console.log(`   Type:    ${update.updateType.toUpperCase()}`);
      console.log(`   Risk:    ${riskLevel} (${update.riskScore}/10)`);
      console.log('');
    });
  }

  generateReport() {
    console.log('📊 DEPENDENCY UPDATE REPORT');
    console.log('=' .repeat(50));
    
    console.log(`📦 Packages checked: ${this.stats.checked}`);
    console.log(`✅ Successfully updated: ${this.stats.updated}`);
    console.log(`❌ Failed updates: ${this.stats.failed}`);
    console.log(`⏭️  Skipped updates: ${this.stats.skipped}`);
    
    if (this.updates.length > 0) {
      console.log('\n✅ SUCCESSFUL UPDATES:');
      this.updates.forEach(update => {
        console.log(`   📦 ${update.name}: ${update.current} → ${update.targetVersion}`);
      });
    }
    
    if (this.failures.length > 0) {
      console.log('\n❌ FAILED UPDATES:');
      this.failures.forEach(failure => {
        console.log(`   📦 ${failure.name}: ${failure.current} → ${failure.targetVersion}`);
        console.log(`      Error: ${failure.error}`);
      });
    }
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      updates: this.updates,
      failures: this.failures,
      dryRun: this.dryRun
    };
    
    const reportPath = path.join(this.projectRoot, 'dependency-update-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
    console.log('=' .repeat(50));
    
    if (this.failures.length > 0 && !this.dryRun) {
      console.log('⚠️  Some updates failed. Review the report and consider manual updates.');
    } else if (this.updates.length > 0 && !this.dryRun) {
      console.log('🎉 Dependency updates completed successfully!');
    }
  }
}

// Run the updater
if (import.meta.url === `file://${process.argv[1]}`) {
  const updater = new DependencyUpdater();
  updater.run().catch(error => {
    console.error('Error running dependency updater:', error);
    process.exit(1);
  });
}

export default DependencyUpdater;
