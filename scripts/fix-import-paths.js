#!/usr/bin/env node

/**
 * Import Path Fixing Script
 * 
 * This script automatically fixes common import path issues:
 * - Converts relative imports to absolute where appropriate
 * - Fixes broken relative import paths
 * - Standardizes import path conventions
 * - Updates imports to use TypeScript path mappings
 * - Removes unused imports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImportPathFixer {
  constructor() {
    this.projectRoot = path.dirname(__dirname); // Go up one level from scripts directory
    this.tsConfig = this.loadTsConfig();
    this.fixes = [];
    this.stats = {
      filesProcessed: 0,
      importsFixed: 0,
      unusedImportsRemoved: 0,
      pathsStandardized: 0
    };
    this.dryRun = process.argv.includes('--dry-run');
  }

  loadTsConfig() {
    try {
      const tsConfigPath = path.join(this.projectRoot, 'tsconfig.json');
      return JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    } catch (error) {
      console.warn('Warning: Could not load tsconfig.json');
      return null;
    }
  }

  async run() {
    console.log(`🔧 ${this.dryRun ? 'Analyzing' : 'Fixing'} import paths...\n`);
    
    const files = this.getAllFiles();
    
    for (const filePath of files) {
      await this.processFile(filePath);
    }
    
    this.generateReport();
    
    if (this.dryRun) {
      console.log('\nTo apply these fixes, run: npm run deps:fix');
    }
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

  async processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.projectRoot, filePath);
      
      let modifiedContent = content;
      let hasChanges = false;
      
      // Fix import statements
      const importRegex = /import\s+((?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g;
      
      modifiedContent = modifiedContent.replace(importRegex, (match, importClause, importPath) => {
        const fixedPath = this.fixImportPath(filePath, importPath);
        
        if (fixedPath !== importPath) {
          hasChanges = true;
          this.stats.importsFixed++;
          
          this.fixes.push({
            file: relativePath,
            type: 'IMPORT_PATH_FIXED',
            original: importPath,
            fixed: fixedPath
          });
          
          return match.replace(importPath, fixedPath);
        }
        
        return match;
      });
      
      // Fix require statements
      const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      
      modifiedContent = modifiedContent.replace(requireRegex, (match, requirePath) => {
        const fixedPath = this.fixImportPath(filePath, requirePath);
        
        if (fixedPath !== requirePath) {
          hasChanges = true;
          this.stats.importsFixed++;
          
          this.fixes.push({
            file: relativePath,
            type: 'REQUIRE_PATH_FIXED',
            original: requirePath,
            fixed: fixedPath
          });
          
          return match.replace(requirePath, fixedPath);
        }
        
        return match;
      });
      
      // Remove unused imports (basic detection)
      modifiedContent = this.removeUnusedImports(modifiedContent, relativePath);
      
      // Standardize import paths (convert to absolute where beneficial)
      modifiedContent = this.standardizeImportPaths(modifiedContent, filePath, relativePath);
      
      // Save changes if not dry run
      if (hasChanges && !this.dryRun) {
        fs.writeFileSync(filePath, modifiedContent);
      }
      
      if (hasChanges) {
        this.stats.filesProcessed++;
      }
      
    } catch (error) {
      console.warn(`   Warning: Could not process ${path.relative(this.projectRoot, filePath)}: ${error.message}`);
    }
  }

  fixImportPath(fromFile, importPath) {
    // Skip external packages
    if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
      return importPath;
    }
    
    const fromDir = path.dirname(fromFile);
    const resolvedPath = path.resolve(fromDir, importPath);
    
    // Check if the import path exists
    if (this.fileExists(resolvedPath)) {
      return importPath; // Path is already correct
    }
    
    // Try to find the correct path
    const correctPath = this.findCorrectPath(fromFile, importPath);
    if (correctPath) {
      return correctPath;
    }
    
    // If we can't fix it, return original
    return importPath;
  }

  findCorrectPath(fromFile, originalPath) {
    const fromDir = path.dirname(fromFile);
    const fileName = path.basename(originalPath);
    
    // Search for the file in common locations
    const searchPaths = [
      // Current directory
      path.join(fromDir, fileName),
      // Parent directory
      path.join(path.dirname(fromDir), fileName),
      // Components directory
      path.join(this.projectRoot, 'app', 'components', fileName),
      // Utils directory
      path.join(this.projectRoot, 'app', 'utils', fileName),
      // Hooks directory
      path.join(this.projectRoot, 'app', 'hooks', fileName),
      // Services directory
      path.join(this.projectRoot, 'app', 'services', fileName)
    ];
    
    for (const searchPath of searchPaths) {
      if (this.fileExists(searchPath)) {
        const relativePath = path.relative(fromDir, searchPath);
        return relativePath.startsWith('.') ? relativePath : './' + relativePath;
      }
    }
    
    return null;
  }

  fileExists(filePath) {
    // Try exact path
    if (fs.existsSync(filePath)) {
      return true;
    }
    
    // Try with extensions
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
    for (const ext of extensions) {
      if (fs.existsSync(filePath + ext)) {
        return true;
      }
    }
    
    // Try index files
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      for (const ext of extensions) {
        if (fs.existsSync(path.join(filePath, 'index' + ext))) {
          return true;
        }
      }
    }
    
    return false;
  }

  removeUnusedImports(content, filePath) {
    // Basic unused import detection
    // This is a simplified version - a full implementation would need AST parsing
    
    const lines = content.split('\n');
    const modifiedLines = [];
    let removedCount = 0;
    
    for (const line of lines) {
      const importMatch = line.match(/import\s+\{([^}]+)\}\s+from\s+['"`]([^'"`]+)['"`]/);
      
      if (importMatch) {
        const imports = importMatch[1].split(',').map(imp => imp.trim());
        const usedImports = imports.filter(imp => {
          const importName = imp.split(' as ')[0].trim();
          // Check if the import is used in the file
          const regex = new RegExp(`\\b${importName}\\b`, 'g');
          const matches = content.match(regex) || [];
          return matches.length > 1; // More than just the import statement
        });
        
        if (usedImports.length === 0) {
          // Remove entire import line
          removedCount++;
          this.fixes.push({
            file: filePath,
            type: 'UNUSED_IMPORT_REMOVED',
            original: line.trim(),
            fixed: '(removed)'
          });
          continue;
        } else if (usedImports.length < imports.length) {
          // Keep only used imports
          const newLine = line.replace(importMatch[1], usedImports.join(', '));
          modifiedLines.push(newLine);
          removedCount++;
          this.fixes.push({
            file: filePath,
            type: 'PARTIAL_IMPORT_CLEANED',
            original: line.trim(),
            fixed: newLine.trim()
          });
          continue;
        }
      }
      
      modifiedLines.push(line);
    }
    
    this.stats.unusedImportsRemoved += removedCount;
    return modifiedLines.join('\n');
  }

  standardizeImportPaths(content, filePath, relativePath) {
    // Convert deep relative imports to absolute imports using TypeScript path mapping
    if (!this.tsConfig || !this.tsConfig.compilerOptions || !this.tsConfig.compilerOptions.paths) {
      return content;
    }
    
    const paths = this.tsConfig.compilerOptions.paths;
    const baseUrl = this.tsConfig.compilerOptions.baseUrl || '.';
    
    // Look for imports that could be converted to absolute paths
    const importRegex = /import\s+((?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)['"`](\.\.\/\.\.\/[^'"`]+)['"`]/g;
    
    return content.replace(importRegex, (match, importClause, importPath) => {
      // Check if this can be converted to an absolute import
      const absolutePath = this.convertToAbsolutePath(filePath, importPath);
      
      if (absolutePath && absolutePath !== importPath) {
        this.stats.pathsStandardized++;
        this.fixes.push({
          file: relativePath,
          type: 'PATH_STANDARDIZED',
          original: importPath,
          fixed: absolutePath
        });
        
        return match.replace(importPath, absolutePath);
      }
      
      return match;
    });
  }

  convertToAbsolutePath(fromFile, relativePath) {
    const fromDir = path.dirname(fromFile);
    const resolvedPath = path.resolve(fromDir, relativePath);
    const projectRelativePath = path.relative(this.projectRoot, resolvedPath);
    
    // Check if this path can be converted to use @/ mapping
    if (projectRelativePath.startsWith('app/')) {
      const appRelativePath = projectRelativePath.substring(4); // Remove 'app/'
      return '@/' + appRelativePath;
    }
    
    return null;
  }

  generateReport() {
    console.log('\n📊 IMPORT PATH FIXING REPORT');
    console.log('=' .repeat(50));
    
    console.log(`📁 Files processed: ${this.stats.filesProcessed}`);
    console.log(`🔧 Import paths fixed: ${this.stats.importsFixed}`);
    console.log(`🗑️  Unused imports removed: ${this.stats.unusedImportsRemoved}`);
    console.log(`📏 Paths standardized: ${this.stats.pathsStandardized}`);
    
    if (this.fixes.length > 0) {
      console.log('\n📝 CHANGES MADE:');
      
      const fixesByType = {};
      this.fixes.forEach(fix => {
        if (!fixesByType[fix.type]) {
          fixesByType[fix.type] = [];
        }
        fixesByType[fix.type].push(fix);
      });
      
      Object.entries(fixesByType).forEach(([type, fixes]) => {
        console.log(`\n   ${type} (${fixes.length} changes):`);
        fixes.slice(0, 10).forEach(fix => { // Show first 10 of each type
          console.log(`     📄 ${fix.file}`);
          console.log(`        "${fix.original}" -> "${fix.fixed}"`);
        });
        
        if (fixes.length > 10) {
          console.log(`     ... and ${fixes.length - 10} more`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(50));
    if (this.fixes.length === 0) {
      console.log('✅ No import path issues found!');
    } else {
      console.log(`${this.dryRun ? '📋' : '✅'} ${this.dryRun ? 'Would fix' : 'Fixed'} ${this.fixes.length} import path issues.`);
    }
    console.log('='.repeat(50));
  }
}

// Run the fixer
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new ImportPathFixer();
  fixer.run().catch(error => {
    console.error('Error fixing import paths:', error);
    process.exit(1);
  });
}

export default ImportPathFixer;
