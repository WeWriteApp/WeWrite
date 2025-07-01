#!/usr/bin/env node

/**
 * Dependency Map Generator
 * 
 * This script generates comprehensive dependency maps showing:
 * - Component relationships and dependencies
 * - Import/export chains
 * - Circular dependency detection
 * - Dependency tree visualization
 * - Critical path analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DependencyMapGenerator {
  constructor() {
    this.projectRoot = path.dirname(__dirname); // Go up one level from scripts directory
    this.dependencyMap = new Map();
    this.reverseDependencyMap = new Map();
    this.circularDependencies = [];
    this.criticalPaths = [];
    this.stats = {
      totalFiles: 0,
      totalDependencies: 0,
      maxDepth: 0,
      circularCount: 0
    };
  }

  async run() {
    console.log('🗺️  Generating dependency map...\n');
    
    // Step 1: Scan all files and build dependency graph
    await this.buildDependencyGraph();
    
    // Step 2: Analyze circular dependencies
    await this.analyzeCircularDependencies();
    
    // Step 3: Find critical paths
    await this.findCriticalPaths();
    
    // Step 4: Generate visualizations
    await this.generateVisualizations();
    
    // Step 5: Save reports
    await this.saveReports();
    
    console.log('✅ Dependency map generation complete!');
  }

  async buildDependencyGraph() {
    console.log('📊 Building dependency graph...');
    
    const files = this.getAllFiles();
    this.stats.totalFiles = files.length;
    
    // First pass: collect all files and their imports
    for (const filePath of files) {
      const relativePath = path.relative(this.projectRoot, filePath);
      const dependencies = this.extractDependencies(filePath);
      
      this.dependencyMap.set(relativePath, dependencies);
      this.stats.totalDependencies += dependencies.length;
      
      // Build reverse dependency map
      dependencies.forEach(dep => {
        if (!this.reverseDependencyMap.has(dep)) {
          this.reverseDependencyMap.set(dep, []);
        }
        this.reverseDependencyMap.get(dep).push(relativePath);
      });
    }
    
    console.log(`   Analyzed ${files.length} files with ${this.stats.totalDependencies} dependencies`);
  }

  getAllFiles() {
    const extensions = ['.js', '.jsx', '.ts', '.tsx'];
    const excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build'];
    const files = [];
    
    const scanDir = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.relative(this.projectRoot, fullPath);
        
        if (excludeDirs.some(exclude => relativePath.startsWith(exclude))) {
          continue;
        }
        
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    scanDir(this.projectRoot);
    return files;
  }

  extractDependencies(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const dependencies = [];
      
      // Extract import statements
      const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g;
      const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      
      let match;
      
      // ES6 imports
      while ((match = importRegex.exec(content)) !== null) {
        const resolvedPath = this.resolveImportPath(filePath, match[1]);
        if (resolvedPath) {
          dependencies.push(resolvedPath);
        }
      }
      
      // CommonJS requires
      while ((match = requireRegex.exec(content)) !== null) {
        const resolvedPath = this.resolveImportPath(filePath, match[1]);
        if (resolvedPath) {
          dependencies.push(resolvedPath);
        }
      }
      
      return [...new Set(dependencies)]; // Remove duplicates
    } catch (error) {
      console.warn(`   Warning: Could not analyze ${path.relative(this.projectRoot, filePath)}`);
      return [];
    }
  }

  resolveImportPath(fromFile, importPath) {
    // Skip external packages
    if (!importPath.startsWith('./') && !importPath.startsWith('../') && !importPath.startsWith('@/')) {
      return null;
    }
    
    const fromDir = path.dirname(fromFile);
    
    // Handle TypeScript path mapping
    if (importPath.startsWith('@/')) {
      const tsConfig = this.loadTsConfig();
      if (tsConfig && tsConfig.compilerOptions && tsConfig.compilerOptions.paths) {
        const paths = tsConfig.compilerOptions.paths;
        const baseUrl = tsConfig.compilerOptions.baseUrl || '.';
        
        for (const [pattern, mappings] of Object.entries(paths)) {
          const regex = new RegExp('^' + pattern.replace('*', '(.*)') + '$');
          const match = importPath.match(regex);
          
          if (match) {
            const replacement = match[1] || '';
            for (const mapping of mappings) {
              const fullPath = path.resolve(
                this.projectRoot,
                baseUrl,
                mapping.replace('*', replacement)
              );
              
              const resolvedFile = this.findActualFile(fullPath);
              if (resolvedFile) {
                return path.relative(this.projectRoot, resolvedFile);
              }
            }
          }
        }
      }
      return null;
    }
    
    // Handle relative imports
    const resolvedPath = path.resolve(fromDir, importPath);
    const actualFile = this.findActualFile(resolvedPath);
    
    if (actualFile) {
      return path.relative(this.projectRoot, actualFile);
    }
    
    return null;
  }

  findActualFile(basePath) {
    // Try exact path
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
      return basePath;
    }
    
    // Try with extensions
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
    for (const ext of extensions) {
      const withExt = basePath + ext;
      if (fs.existsSync(withExt)) {
        return withExt;
      }
    }
    
    // Try index files
    if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
      for (const ext of extensions) {
        const indexFile = path.join(basePath, 'index' + ext);
        if (fs.existsSync(indexFile)) {
          return indexFile;
        }
      }
    }
    
    return null;
  }

  loadTsConfig() {
    try {
      const tsConfigPath = path.join(this.projectRoot, 'tsconfig.json');
      return JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    } catch (error) {
      return null;
    }
  }

  async analyzeCircularDependencies() {
    console.log('🔄 Analyzing circular dependencies...');
    
    const visited = new Set();
    const recursionStack = new Set();
    const pathStack = [];
    
    const dfs = (file) => {
      if (recursionStack.has(file)) {
        // Found a cycle
        const cycleStart = pathStack.indexOf(file);
        const cycle = pathStack.slice(cycleStart).concat([file]);
        this.circularDependencies.push(cycle);
        return;
      }
      
      if (visited.has(file)) {
        return;
      }
      
      visited.add(file);
      recursionStack.add(file);
      pathStack.push(file);
      
      const dependencies = this.dependencyMap.get(file) || [];
      for (const dep of dependencies) {
        if (this.dependencyMap.has(dep)) {
          dfs(dep);
        }
      }
      
      recursionStack.delete(file);
      pathStack.pop();
    };
    
    for (const file of this.dependencyMap.keys()) {
      if (!visited.has(file)) {
        dfs(file);
      }
    }
    
    this.stats.circularCount = this.circularDependencies.length;
    console.log(`   Found ${this.circularDependencies.length} circular dependencies`);
  }

  async findCriticalPaths() {
    console.log('🎯 Finding critical paths...');
    
    // Find files with the most dependencies (incoming)
    const dependencyCounts = new Map();
    
    for (const [file, deps] of this.reverseDependencyMap) {
      dependencyCounts.set(file, deps.length);
    }
    
    // Sort by dependency count
    const sortedByDependencies = [...dependencyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    this.criticalPaths = sortedByDependencies.map(([file, count]) => ({
      file,
      dependentCount: count,
      dependents: this.reverseDependencyMap.get(file) || []
    }));
    
    console.log(`   Identified ${this.criticalPaths.length} critical paths`);
  }

  async generateVisualizations() {
    console.log('📈 Generating visualizations...');
    
    // Generate Mermaid diagram for top-level dependencies
    const mermaidDiagram = this.generateMermaidDiagram();
    
    // Generate DOT graph for Graphviz
    const dotGraph = this.generateDotGraph();
    
    // Save visualizations
    fs.writeFileSync(
      path.join(this.projectRoot, 'dependency-map.mermaid'),
      mermaidDiagram
    );
    
    fs.writeFileSync(
      path.join(this.projectRoot, 'dependency-map.dot'),
      dotGraph
    );
    
    console.log('   Saved dependency-map.mermaid and dependency-map.dot');
  }

  generateMermaidDiagram() {
    let diagram = 'graph TD\n';
    
    // Add nodes for critical files only (to keep diagram readable)
    const criticalFiles = new Set(this.criticalPaths.slice(0, 20).map(cp => cp.file));
    
    for (const [file, dependencies] of this.dependencyMap) {
      if (criticalFiles.has(file)) {
        const nodeId = this.sanitizeNodeId(file);
        const fileName = path.basename(file);
        diagram += `    ${nodeId}["${fileName}"]\n`;
        
        for (const dep of dependencies) {
          if (criticalFiles.has(dep)) {
            const depNodeId = this.sanitizeNodeId(dep);
            diagram += `    ${nodeId} --> ${depNodeId}\n`;
          }
        }
      }
    }
    
    // Add styling for circular dependencies
    if (this.circularDependencies.length > 0) {
      diagram += '\n    %% Circular dependencies in red\n';
      for (const cycle of this.circularDependencies.slice(0, 5)) {
        for (const file of cycle) {
          if (criticalFiles.has(file)) {
            const nodeId = this.sanitizeNodeId(file);
            diagram += `    ${nodeId} --> ${nodeId}\n`;
            diagram += `    class ${nodeId} circular\n`;
          }
        }
      }
      diagram += '    classDef circular fill:#ff9999,stroke:#ff0000\n';
    }
    
    return diagram;
  }

  generateDotGraph() {
    let graph = 'digraph DependencyMap {\n';
    graph += '    rankdir=TB;\n';
    graph += '    node [shape=box, style=rounded];\n\n';
    
    // Add nodes
    for (const file of this.dependencyMap.keys()) {
      const nodeId = this.sanitizeNodeId(file);
      const fileName = path.basename(file);
      const dependentCount = (this.reverseDependencyMap.get(file) || []).length;
      
      let color = 'lightblue';
      if (dependentCount > 10) color = 'orange';
      if (dependentCount > 20) color = 'red';
      
      graph += `    "${nodeId}" [label="${fileName}\\n(${dependentCount} deps)", fillcolor=${color}, style=filled];\n`;
    }
    
    graph += '\n';
    
    // Add edges
    for (const [file, dependencies] of this.dependencyMap) {
      const fromId = this.sanitizeNodeId(file);
      for (const dep of dependencies) {
        if (this.dependencyMap.has(dep)) {
          const toId = this.sanitizeNodeId(dep);
          graph += `    "${fromId}" -> "${toId}";\n`;
        }
      }
    }
    
    graph += '}\n';
    return graph;
  }

  sanitizeNodeId(filePath) {
    return filePath.replace(/[^a-zA-Z0-9]/g, '_');
  }

  async saveReports() {
    console.log('💾 Saving reports...');
    
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      circularDependencies: this.circularDependencies,
      criticalPaths: this.criticalPaths,
      dependencyMap: Object.fromEntries(this.dependencyMap),
      reverseDependencyMap: Object.fromEntries(this.reverseDependencyMap)
    };
    
    // Save JSON report
    fs.writeFileSync(
      path.join(this.projectRoot, 'dependency-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Save human-readable report
    let textReport = 'DEPENDENCY MAP REPORT\n';
    textReport += '='.repeat(50) + '\n\n';
    
    textReport += `Generated: ${report.timestamp}\n`;
    textReport += `Total files: ${this.stats.totalFiles}\n`;
    textReport += `Total dependencies: ${this.stats.totalDependencies}\n`;
    textReport += `Circular dependencies: ${this.stats.circularCount}\n\n`;
    
    if (this.circularDependencies.length > 0) {
      textReport += 'CIRCULAR DEPENDENCIES:\n';
      textReport += '-'.repeat(30) + '\n';
      this.circularDependencies.forEach((cycle, index) => {
        textReport += `${index + 1}. ${cycle.join(' -> ')}\n`;
      });
      textReport += '\n';
    }
    
    textReport += 'CRITICAL PATHS (Most Depended Upon):\n';
    textReport += '-'.repeat(30) + '\n';
    this.criticalPaths.forEach((cp, index) => {
      textReport += `${index + 1}. ${cp.file} (${cp.dependentCount} dependents)\n`;
    });
    
    fs.writeFileSync(
      path.join(this.projectRoot, 'dependency-report.txt'),
      textReport
    );
    
    console.log('   Saved dependency-report.json and dependency-report.txt');
  }
}

// Run the generator
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new DependencyMapGenerator();
  generator.run().catch(error => {
    console.error('Error generating dependency map:', error);
    process.exit(1);
  });
}

export default DependencyMapGenerator;
