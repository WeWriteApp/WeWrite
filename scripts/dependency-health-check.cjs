#!/usr/bin/env node

/**
 * Comprehensive Dependency Health Check
 * Checks for security vulnerabilities, outdated packages, and dependency issues
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DependencyHealthChecker {
  constructor() {
    this.results = {
      vulnerabilities: [],
      outdated: [],
      issues: [],
      recommendations: []
    };
  }

  async runHealthCheck() {
    console.log('🔍 Running comprehensive dependency health check...\n');

    try {
      await this.checkVulnerabilities();
      await this.checkOutdatedPackages();
      await this.checkPackageIntegrity();
      await this.checkLockFileConsistency();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    }
  }

  async checkVulnerabilities() {
    console.log('🛡️  Checking for security vulnerabilities...');
    
    try {
      // Run npm audit with JSON output
      const auditResult = execSync('npm audit --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const audit = JSON.parse(auditResult);
      
      if (audit.vulnerabilities && Object.keys(audit.vulnerabilities).length > 0) {
        this.results.vulnerabilities = Object.entries(audit.vulnerabilities).map(([name, vuln]) => ({
          name,
          severity: vuln.severity,
          via: vuln.via,
          effects: vuln.effects,
          range: vuln.range,
          fixAvailable: vuln.fixAvailable
        }));
        
        console.log(`   ⚠️  Found ${this.results.vulnerabilities.length} vulnerabilities`);
      } else {
        console.log('   ✅ No vulnerabilities found');
      }
    } catch (error) {
      if (error.status === 0) {
        console.log('   ✅ No vulnerabilities found');
      } else {
        console.log('   ⚠️  Could not check vulnerabilities:', error.message);
        this.results.issues.push('Vulnerability check failed');
      }
    }
  }

  async checkOutdatedPackages() {
    console.log('📦 Checking for outdated packages...');
    
    try {
      const outdatedResult = execSync('npm outdated --json', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      const outdated = JSON.parse(outdatedResult);
      
      if (Object.keys(outdated).length > 0) {
        this.results.outdated = Object.entries(outdated).map(([name, info]) => ({
          name,
          current: info.current,
          wanted: info.wanted,
          latest: info.latest,
          location: info.location
        }));
        
        console.log(`   📈 Found ${this.results.outdated.length} outdated packages`);
      } else {
        console.log('   ✅ All packages are up to date');
      }
    } catch (error) {
      if (error.status === 1) {
        // npm outdated returns exit code 1 when there are outdated packages
        try {
          const outdatedResult = error.stdout;
          if (outdatedResult) {
            const outdated = JSON.parse(outdatedResult);
            this.results.outdated = Object.entries(outdated).map(([name, info]) => ({
              name,
              current: info.current,
              wanted: info.wanted,
              latest: info.latest,
              location: info.location
            }));
            console.log(`   📈 Found ${this.results.outdated.length} outdated packages`);
          }
        } catch (parseError) {
          console.log('   ✅ All packages appear to be up to date');
        }
      } else {
        console.log('   ⚠️  Could not check outdated packages:', error.message);
        this.results.issues.push('Outdated package check failed');
      }
    }
  }

  async checkPackageIntegrity() {
    console.log('🔒 Checking package integrity...');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageLockPath = path.join(process.cwd(), 'package-lock.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      this.results.issues.push('package.json not found');
      return;
    }
    
    if (!fs.existsSync(packageLockPath)) {
      this.results.issues.push('package-lock.json not found');
      console.log('   ⚠️  package-lock.json not found');
      return;
    }
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
      
      // Check for critical security packages
      const securityPackages = [
        'helmet',
        'cors',
        'express-rate-limit',
        'bcrypt',
        'jsonwebtoken'
      ];
      
      const missingSecurityPackages = securityPackages.filter(pkg => 
        !packageJson.dependencies?.[pkg] && !packageJson.devDependencies?.[pkg]
      );
      
      if (missingSecurityPackages.length > 0) {
        this.results.recommendations.push({
          type: 'security',
          message: `Consider adding security packages: ${missingSecurityPackages.join(', ')}`
        });
      }
      
      console.log('   ✅ Package integrity check completed');
    } catch (error) {
      this.results.issues.push('Package integrity check failed');
      console.log('   ❌ Package integrity check failed:', error.message);
    }
  }

  async checkLockFileConsistency() {
    console.log('🔄 Checking lock file consistency...');
    
    try {
      // This will fail if package-lock.json is inconsistent with package.json
      execSync('npm ci --dry-run', { 
        stdio: ['pipe', 'pipe', 'pipe']
      });
      console.log('   ✅ Lock file is consistent');
    } catch (error) {
      this.results.issues.push('Lock file inconsistency detected');
      console.log('   ⚠️  Lock file may be inconsistent with package.json');
      this.results.recommendations.push({
        type: 'maintenance',
        message: 'Run "npm install" to update package-lock.json'
      });
    }
  }

  async generateReport() {
    console.log('\n📊 DEPENDENCY HEALTH REPORT');
    console.log('='.repeat(50));

    // Vulnerabilities
    if (this.results.vulnerabilities.length > 0) {
      console.log('\n🛡️  SECURITY VULNERABILITIES:');
      this.results.vulnerabilities.forEach(vuln => {
        console.log(`   ❌ ${vuln.name} (${vuln.severity})`);
        if (vuln.fixAvailable) {
          console.log(`      Fix: ${vuln.fixAvailable === true ? 'Available' : vuln.fixAvailable}`);
        }
      });
    }

    // Outdated packages
    if (this.results.outdated.length > 0) {
      console.log('\n📦 OUTDATED PACKAGES:');
      this.results.outdated.slice(0, 10).forEach(pkg => {
        console.log(`   📈 ${pkg.name}: ${pkg.current} → ${pkg.latest}`);
      });

      if (this.results.outdated.length > 10) {
        console.log(`   ... and ${this.results.outdated.length - 10} more`);
      }
    }

    // Issues
    if (this.results.issues.length > 0) {
      console.log('\n⚠️  ISSUES FOUND:');
      this.results.issues.forEach(issue => {
        console.log(`   ❌ ${issue}`);
      });
    }

    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach(rec => {
        console.log(`   💡 ${rec.message}`);
      });
    }

    // Summary
    const totalIssues = this.results.vulnerabilities.length + this.results.issues.length;
    console.log('\n📈 SUMMARY:');
    console.log(`   Vulnerabilities: ${this.results.vulnerabilities.length}`);
    console.log(`   Outdated packages: ${this.results.outdated.length}`);
    console.log(`   Issues: ${this.results.issues.length}`);
    console.log(`   Recommendations: ${this.results.recommendations.length}`);

    if (totalIssues === 0) {
      console.log('\n✅ All dependency health checks passed!');
    } else {
      console.log(`\n⚠️  Found ${totalIssues} issues that need attention`);
    }

    // Save detailed report
    const reportPath = path.join(process.cwd(), 'dependency-health-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
  }
}

// Run if called directly
if (require.main === module) {
  const checker = new DependencyHealthChecker();
  checker.runHealthCheck().catch(error => {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  });
}

module.exports = DependencyHealthChecker;
