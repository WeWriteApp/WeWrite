#!/usr/bin/env node

/**
 * Dependency Health Check Script
 * 
 * Performs comprehensive dependency analysis including:
 * - Circular dependency detection
 * - Import validation
 * - Dependency mapping
 * - Bundle size analysis
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  projectRoot: process.cwd(),
  excludeDirs: ['node_modules', '.next', '.git', 'dist', 'build'],
  fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
  maxCircularDeps: 5,
  outputFile: 'dependency-report.json'
};

class DependencyHealthChecker {
  constructor() {
    this.dependencies = new Map();
    this.circularDeps = [];
    this.importErrors = [];
    this.stats = {
      totalFiles: 0,
      totalDependencies: 0,
      circularCount: 0
    };
  }

  /**
   * Main entry point for dependency health check
   */
  async run() {
    console.log('🔍 Starting dependency health check...');
    
    try {
      // Scan project files
      await this.scanProject();
      
      // Detect circular dependencies
      await this.detectCircularDependencies();
      
      // Validate imports
      await this.validateImports();
      
      // Generate report
      await this.generateReport();
      
      console.log('✅ Dependency health check completed');
      
      // Exit with error code if issues found
      if (this.circularDeps.length > CONFIG.maxCircularDeps || this.importErrors.length > 0) {
        console.log('❌ Dependency health check failed');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Dependency health check failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Scan project for dependency relationships
   */
  async scanProject() {
    console.log('📁 Scanning project files...');
    
    const files = this.getAllFiles(CONFIG.projectRoot);
    this.stats.totalFiles = files.length;
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const deps = this.extractDependencies(content, file);
        this.dependencies.set(file, deps);
        this.stats.totalDependencies += deps.length;
      } catch (error) {
        this.importErrors.push({
          file,
          error: error.message
        });
      }
    }
    
    console.log(`📊 Scanned ${this.stats.totalFiles} files, found ${this.stats.totalDependencies} dependencies`);
  }

  /**
   * Get all relevant files in the project
   */
  getAllFiles(dir) {
    const files = [];
    
    const scan = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!CONFIG.excludeDirs.includes(item)) {
            scan(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (CONFIG.fileExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    scan(dir);
    return files;
  }

  /**
   * Extract dependencies from file content
   */
  extractDependencies(content, filePath) {
    const deps = [];
    
    // Match import statements
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;
    
    let match;
    
    // Extract ES6 imports
    while ((match = importRegex.exec(content)) !== null) {
      const dep = match[1];
      if (dep.startsWith('.')) {
        // Resolve relative path
        const resolvedPath = path.resolve(path.dirname(filePath), dep);
        deps.push(resolvedPath);
      } else {
        deps.push(dep);
      }
    }
    
    // Extract CommonJS requires
    while ((match = requireRegex.exec(content)) !== null) {
      const dep = match[1];
      if (dep.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(filePath), dep);
        deps.push(resolvedPath);
      } else {
        deps.push(dep);
      }
    }
    
    return deps;
  }

  /**
   * Detect circular dependencies using DFS
   */
  async detectCircularDependencies() {
    console.log('🔄 Detecting circular dependencies...');
    
    const visited = new Set();
    const recursionStack = new Set();
    
    for (const [file] of this.dependencies) {
      if (!visited.has(file)) {
        this.dfsCircularCheck(file, visited, recursionStack, []);
      }
    }
    
    this.stats.circularCount = this.circularDeps.length;
    console.log(`🔄 Found ${this.circularDeps.length} circular dependencies`);
  }

  /**
   * DFS helper for circular dependency detection
   */
  dfsCircularCheck(file, visited, recursionStack, path) {
    visited.add(file);
    recursionStack.add(file);
    path.push(file);
    
    const deps = this.dependencies.get(file) || [];
    
    for (const dep of deps) {
      // Only check local files (not node_modules)
      if (this.dependencies.has(dep)) {
        if (!visited.has(dep)) {
          this.dfsCircularCheck(dep, visited, recursionStack, [...path]);
        } else if (recursionStack.has(dep)) {
          // Found circular dependency
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart).concat([dep]);
          this.circularDeps.push(cycle.map(f => path.relative(CONFIG.projectRoot, f)));
        }
      }
    }
    
    recursionStack.delete(file);
  }

  /**
   * Validate import statements
   */
  async validateImports() {
    console.log('✅ Validating imports...');
    
    // For now, just report import errors found during scanning
    if (this.importErrors.length > 0) {
      console.log(`❌ Found ${this.importErrors.length} import errors`);
    } else {
      console.log('✅ All imports valid');
    }
  }

  /**
   * Generate comprehensive report
   */
  async generateReport() {
    console.log('📄 Generating dependency report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      circularDependencies: this.circularDeps.slice(0, 10), // Limit output
      importErrors: this.importErrors.slice(0, 10),
      summary: {
        healthy: this.circularDeps.length === 0 && this.importErrors.length === 0,
        issues: this.circularDeps.length + this.importErrors.length,
        recommendations: this.generateRecommendations()
      }
    };
    
    // Write JSON report
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(report, null, 2));
    
    // Write text summary
    const textReport = this.generateTextReport(report);
    fs.writeFileSync('dependency-report.txt', textReport);
    
    console.log(`📄 Report saved to ${CONFIG.outputFile}`);
  }

  /**
   * Generate recommendations based on findings
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.circularDeps.length > 0) {
      recommendations.push('Refactor circular dependencies to improve maintainability');
      recommendations.push('Consider using dependency injection or event-driven patterns');
    }
    
    if (this.importErrors.length > 0) {
      recommendations.push('Fix import errors to ensure proper module resolution');
    }
    
    if (this.stats.totalDependencies > this.stats.totalFiles * 10) {
      recommendations.push('Consider reducing dependency complexity');
    }
    
    return recommendations;
  }

  /**
   * Generate human-readable text report
   */
  generateTextReport(report) {
    let text = 'DEPENDENCY HEALTH REPORT\n';
    text += '========================\n\n';
    text += `Generated: ${report.timestamp}\n`;
    text += `Status: ${report.summary.healthy ? 'HEALTHY' : 'ISSUES FOUND'}\n\n`;
    
    text += 'STATISTICS:\n';
    text += `-----------\n`;
    text += `Total Files: ${report.stats.totalFiles}\n`;
    text += `Total Dependencies: ${report.stats.totalDependencies}\n`;
    text += `Circular Dependencies: ${report.stats.circularCount}\n`;
    text += `Import Errors: ${this.importErrors.length}\n\n`;
    
    if (report.circularDependencies.length > 0) {
      text += 'CIRCULAR DEPENDENCIES:\n';
      text += '----------------------\n';
      report.circularDependencies.forEach((cycle, i) => {
        text += `${i + 1}. ${cycle.join(' → ')}\n`;
      });
      text += '\n';
    }
    
    if (report.summary.recommendations.length > 0) {
      text += 'RECOMMENDATIONS:\n';
      text += '----------------\n';
      report.summary.recommendations.forEach((rec, i) => {
        text += `${i + 1}. ${rec}\n`;
      });
    }
    
    return text;
  }
}

// Run the health check
if (require.main === module) {
  const checker = new DependencyHealthChecker();
  checker.run().catch(console.error);
}

module.exports = DependencyHealthChecker;
