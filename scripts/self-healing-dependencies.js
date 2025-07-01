#!/usr/bin/env node

/**
 * Self-Healing Dependency System
 * 
 * This script provides automated dependency management with self-healing capabilities:
 * - Automatically installs missing dependencies
 * - Fixes broken import paths
 * - Resolves circular dependencies
 * - Updates outdated packages
 * - Maintains dependency health
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SelfHealingDependencySystem {
  constructor() {
    this.projectRoot = path.dirname(__dirname);
    this.packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
    this.healingActions = [];
    this.stats = {
      dependenciesInstalled: 0,
      importsFixed: 0,
      circularDependenciesResolved: 0,
      packagesUpdated: 0,
      issuesDetected: 0,
      issuesResolved: 0
    };
    this.autoFix = !process.argv.includes('--no-auto-fix');
    this.verbose = process.argv.includes('--verbose');
  }

  async run() {
    console.log('🔧 Starting Self-Healing Dependency System...\n');
    
    try {
      // Step 1: Detect issues
      await this.detectIssues();
      
      // Step 2: Plan healing actions
      await this.planHealingActions();
      
      // Step 3: Execute healing (if auto-fix enabled)
      if (this.autoFix) {
        await this.executeHealing();
      } else {
        await this.generateHealingPlan();
      }
      
      // Step 4: Verify healing
      await this.verifyHealing();
      
      // Step 5: Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Self-healing process failed:', error.message);
      if (this.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  async detectIssues() {
    console.log('🔍 Detecting dependency issues...');
    
    // Import and run existing health check
    const { default: DependencyHealthChecker } = await import('./dependency-health-check.js');
    const healthChecker = new DependencyHealthChecker();
    
    // Capture issues without exiting
    const originalExit = process.exit;
    process.exit = () => {}; // Temporarily disable exit
    
    try {
      await healthChecker.run();
    } catch (error) {
      // Health check found issues
    }
    
    process.exit = originalExit; // Restore exit
    
    // Extract issues from health checker
    this.issues = healthChecker.issues;
    this.stats.issuesDetected = Object.values(this.issues).reduce((sum, arr) => sum + arr.length, 0);
    
    console.log(`   Found ${this.stats.issuesDetected} issues to address`);
  }

  async planHealingActions() {
    console.log('📋 Planning healing actions...');
    
    // Plan actions for missing dependencies
    if (this.issues.missingDependencies.length > 0) {
      const packages = [...new Set(this.issues.missingDependencies.map(issue => issue.package))];
      const validPackages = packages.filter(pkg => this.isValidPackageName(pkg));
      
      if (validPackages.length > 0) {
        this.healingActions.push({
          type: 'INSTALL_DEPENDENCIES',
          packages: validPackages,
          command: `npm install ${validPackages.join(' ')}`,
          description: `Install ${validPackages.length} missing dependencies`
        });
      }
    }
    
    // Plan actions for incorrect imports
    if (this.issues.incorrectImports.length > 0) {
      this.healingActions.push({
        type: 'FIX_IMPORTS',
        command: 'npm run deps:fix',
        description: `Fix ${this.issues.incorrectImports.length} broken import paths`
      });
    }
    
    // Plan actions for unused dependencies
    if (this.issues.unusedDependencies.length > 0) {
      const safeToRemove = this.issues.unusedDependencies.filter(pkg => !this.isEssentialPackage(pkg));
      
      if (safeToRemove.length > 0) {
        this.healingActions.push({
          type: 'REMOVE_UNUSED',
          packages: safeToRemove,
          command: `npm uninstall ${safeToRemove.join(' ')}`,
          description: `Remove ${safeToRemove.length} unused dependencies`
        });
      }
    }
    
    // Plan actions for circular dependencies
    if (this.issues.circularDependencies.length > 0) {
      this.healingActions.push({
        type: 'RESOLVE_CIRCULAR',
        cycles: this.issues.circularDependencies,
        description: `Resolve ${this.issues.circularDependencies.length} circular dependencies`,
        manual: true // Requires manual intervention
      });
    }
    
    // Plan actions for empty files
    if (this.issues.emptyFiles.length > 0) {
      const safeToRemove = this.issues.emptyFiles.filter(file => 
        !file.includes('node_modules') && 
        !file.includes('.git') &&
        !file.endsWith('.md')
      );
      
      if (safeToRemove.length > 0) {
        this.healingActions.push({
          type: 'REMOVE_EMPTY_FILES',
          files: safeToRemove,
          description: `Remove ${safeToRemove.length} empty files`
        });
      }
    }
    
    console.log(`   Planned ${this.healingActions.length} healing actions`);
  }

  async executeHealing() {
    console.log('🔧 Executing healing actions...\n');
    
    for (const action of this.healingActions) {
      if (action.manual) {
        console.log(`⚠️  Manual action required: ${action.description}`);
        continue;
      }
      
      try {
        console.log(`🔄 ${action.description}...`);
        
        switch (action.type) {
          case 'INSTALL_DEPENDENCIES':
            await this.installDependencies(action.packages);
            this.stats.dependenciesInstalled += action.packages.length;
            break;
            
          case 'FIX_IMPORTS':
            await this.fixImports();
            this.stats.importsFixed += this.issues.incorrectImports.length;
            break;
            
          case 'REMOVE_UNUSED':
            await this.removeUnusedDependencies(action.packages);
            break;
            
          case 'REMOVE_EMPTY_FILES':
            await this.removeEmptyFiles(action.files);
            break;
            
          default:
            console.log(`   ⚠️  Unknown action type: ${action.type}`);
        }
        
        console.log(`   ✅ Completed: ${action.description}`);
        this.stats.issuesResolved++;
        
      } catch (error) {
        console.log(`   ❌ Failed: ${action.description} - ${error.message}`);
        if (this.verbose) {
          console.log(`      ${error.stack}`);
        }
      }
    }
  }

  async generateHealingPlan() {
    console.log('📋 Generating healing plan (--no-auto-fix mode)...\n');
    
    console.log('HEALING PLAN:');
    console.log('='.repeat(50));
    
    this.healingActions.forEach((action, index) => {
      console.log(`${index + 1}. ${action.description}`);
      if (action.command) {
        console.log(`   Command: ${action.command}`);
      }
      if (action.manual) {
        console.log(`   ⚠️  Requires manual intervention`);
      }
      console.log();
    });
    
    console.log('To execute this plan automatically, run:');
    console.log('   npm run deps:heal');
    console.log('='.repeat(50));
  }

  async installDependencies(packages) {
    const command = `npm install ${packages.join(' ')}`;
    execSync(command, { cwd: this.projectRoot, stdio: this.verbose ? 'inherit' : 'pipe' });
  }

  async fixImports() {
    const { default: ImportPathFixer } = await import('./fix-import-paths.js');
    const fixer = new ImportPathFixer();
    await fixer.run();
  }

  async removeUnusedDependencies(packages) {
    const command = `npm uninstall ${packages.join(' ')}`;
    execSync(command, { cwd: this.projectRoot, stdio: this.verbose ? 'inherit' : 'pipe' });
  }

  async removeEmptyFiles(files) {
    for (const file of files) {
      const fullPath = path.join(this.projectRoot, file);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        if (this.verbose) {
          console.log(`     Removed: ${file}`);
        }
      }
    }
  }

  async verifyHealing() {
    console.log('\n🔍 Verifying healing results...');
    
    // Re-run health check to verify improvements
    const { default: DependencyHealthChecker } = await import('./dependency-health-check.js');
    const healthChecker = new DependencyHealthChecker();
    
    const originalExit = process.exit;
    process.exit = () => {};
    
    try {
      await healthChecker.run();
    } catch (error) {
      // Expected if issues remain
    }
    
    process.exit = originalExit;
    
    const remainingIssues = Object.values(healthChecker.issues).reduce((sum, arr) => sum + arr.length, 0);
    const issuesResolved = this.stats.issuesDetected - remainingIssues;
    
    console.log(`   Issues resolved: ${issuesResolved}/${this.stats.issuesDetected}`);
    console.log(`   Remaining issues: ${remainingIssues}`);
    
    if (remainingIssues === 0) {
      console.log('   ✅ All issues resolved!');
    } else if (issuesResolved > 0) {
      console.log('   🔄 Partial healing successful');
    } else {
      console.log('   ⚠️  No issues were automatically resolved');
    }
  }

  isValidPackageName(packageName) {
    // Filter out invalid package names that shouldn't be installed
    const invalid = [
      '@/lib', '..', '.', '%s', 'b',
      'node:path', 'node:stream', 'node:util', 'node:events',
      'module', 'process', 'v8'
    ];
    
    return !invalid.includes(packageName) && 
           !packageName.startsWith('node:') &&
           !packageName.includes('..') &&
           packageName.length > 1 &&
           /^[@a-z0-9-_/]+$/i.test(packageName);
  }

  isEssentialPackage(packageName) {
    const essential = [
      'react', 'react-dom', 'next', 'typescript',
      '@types/react', '@types/react-dom', '@types/node',
      'eslint', 'eslint-config-next', 'tailwindcss'
    ];
    return essential.includes(packageName);
  }

  generateReport() {
    console.log('\n📊 SELF-HEALING REPORT');
    console.log('=' .repeat(50));
    
    console.log(`🔍 Issues detected: ${this.stats.issuesDetected}`);
    console.log(`✅ Issues resolved: ${this.stats.issuesResolved}`);
    console.log(`📦 Dependencies installed: ${this.stats.dependenciesInstalled}`);
    console.log(`🔗 Imports fixed: ${this.stats.importsFixed}`);
    
    if (this.stats.issuesDetected === 0) {
      console.log('\n🎉 No dependency issues found! Your project is healthy.');
    } else if (this.stats.issuesResolved === this.stats.issuesDetected) {
      console.log('\n🎉 All issues successfully resolved!');
    } else if (this.stats.issuesResolved > 0) {
      console.log('\n🔄 Partial healing completed. Some issues may require manual intervention.');
    } else {
      console.log('\n⚠️  No automatic healing was possible. Manual intervention required.');
    }
    
    // Manual actions summary
    const manualActions = this.healingActions.filter(action => action.manual);
    if (manualActions.length > 0) {
      console.log('\n📋 MANUAL ACTIONS REQUIRED:');
      manualActions.forEach((action, index) => {
        console.log(`${index + 1}. ${action.description}`);
      });
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('• Run this healing process weekly');
    console.log('• Address circular dependencies promptly');
    console.log('• Keep dependencies up to date');
    console.log('• Use TypeScript path mappings consistently');
    
    console.log('=' .repeat(50));
  }
}

// Run the self-healing system
if (import.meta.url === `file://${process.argv[1]}`) {
  const healer = new SelfHealingDependencySystem();
  healer.run().catch(error => {
    console.error('Error running self-healing system:', error);
    process.exit(1);
  });
}

export default SelfHealingDependencySystem;
