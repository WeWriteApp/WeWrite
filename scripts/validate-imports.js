#!/usr/bin/env node

/**
 * Import Validation Script
 * 
 * This script validates all import statements in the codebase to ensure:
 * - All imports resolve to existing files
 * - TypeScript path mappings are correctly configured
 * - No broken relative imports exist
 * - Import statements follow consistent patterns
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImportValidator {
  constructor() {
    this.projectRoot = path.dirname(__dirname); // Go up one level from scripts directory
    this.tsConfig = this.loadTsConfig();
    this.errors = [];
    this.warnings = [];
    this.stats = {
      totalFiles: 0,
      totalImports: 0,
      validImports: 0,
      invalidImports: 0
    };
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
    console.log('🔍 Validating all imports...\n');
    
    const files = this.getAllFiles();
    this.stats.totalFiles = files.length;
    
    for (const filePath of files) {
      await this.validateFileImports(filePath);
    }
    
    this.generateReport();
    
    // Exit with error code if there are validation errors
    process.exit(this.errors.length > 0 ? 1 : 0);
  }

  getAllFiles() {
    const extensions = ['.js', '.jsx', '.ts', '.tsx'];
    const excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build', 'functions/node_modules', 'scripts/node_modules'];
    const files = [];
    
    const scanDir = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.relative(this.projectRoot, fullPath);
        
        // Skip excluded directories
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

  async validateFileImports(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(this.projectRoot, filePath);
      
      // Extract all import statements
      const imports = this.extractImports(content);
      this.stats.totalImports += imports.length;
      
      for (const importInfo of imports) {
        const isValid = await this.validateImport(filePath, importInfo);
        if (isValid) {
          this.stats.validImports++;
        } else {
          this.stats.invalidImports++;
        }
      }
      
    } catch (error) {
      this.errors.push({
        type: 'FILE_READ_ERROR',
        file: path.relative(this.projectRoot, filePath),
        message: `Could not read file: ${error.message}`
      });
    }
  }

  extractImports(content) {
    const imports = [];
    
    // ES6 import statements
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"`]([^'"`]+)['"`]/g;
    
    // CommonJS require statements
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    
    // Dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    
    let match;
    
    // Extract ES6 imports
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        type: 'import',
        path: match[1],
        line: this.getLineNumber(content, match.index)
      });
    }
    
    // Extract CommonJS requires
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push({
        type: 'require',
        path: match[1],
        line: this.getLineNumber(content, match.index)
      });
    }
    
    // Extract dynamic imports
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push({
        type: 'dynamic',
        path: match[1],
        line: this.getLineNumber(content, match.index)
      });
    }
    
    return imports;
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  async validateImport(fromFile, importInfo) {
    const { path: importPath, line, type } = importInfo;
    const fromDir = path.dirname(fromFile);
    const relativePath = path.relative(this.projectRoot, fromFile);
    
    // Skip built-in Node.js modules
    if (this.isBuiltinModule(importPath)) {
      return true;
    }
    
    // Skip external packages (not relative imports)
    if (!importPath.startsWith('./') && !importPath.startsWith('../') && !importPath.startsWith('@/')) {
      return this.validateExternalPackage(importPath, relativePath, line);
    }
    
    // Handle TypeScript path mapping (@/ imports)
    if (importPath.startsWith('@/')) {
      return this.validatePathMappedImport(importPath, relativePath, line);
    }
    
    // Validate relative imports
    return this.validateRelativeImport(fromFile, importPath, relativePath, line);
  }

  validateExternalPackage(packageName, file, line) {
    // Extract the actual package name (handle scoped packages and subpaths)
    let actualPackageName = packageName;
    if (packageName.startsWith('@')) {
      const parts = packageName.split('/');
      actualPackageName = parts.slice(0, 2).join('/');
    } else {
      actualPackageName = packageName.split('/')[0];
    }
    
    // Check if package exists in package.json
    const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };
    
    if (!allDeps[actualPackageName]) {
      this.errors.push({
        type: 'MISSING_DEPENDENCY',
        file,
        line,
        import: packageName,
        message: `Package "${actualPackageName}" is not listed in package.json dependencies`
      });
      return false;
    }
    
    return true;
  }

  validatePathMappedImport(importPath, file, line) {
    if (!this.tsConfig || !this.tsConfig.compilerOptions || !this.tsConfig.compilerOptions.paths) {
      this.errors.push({
        type: 'PATH_MAPPING_NOT_CONFIGURED',
        file,
        line,
        import: importPath,
        message: 'TypeScript path mapping is used but not configured in tsconfig.json'
      });
      return false;
    }
    
    const paths = this.tsConfig.compilerOptions.paths;
    const baseUrl = this.tsConfig.compilerOptions.baseUrl || '.';
    
    // Find matching path mapping
    let resolvedPath = null;
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
          
          if (this.fileExists(fullPath)) {
            resolvedPath = fullPath;
            break;
          }
        }
        break;
      }
    }
    
    if (!resolvedPath) {
      this.errors.push({
        type: 'INVALID_PATH_MAPPING',
        file,
        line,
        import: importPath,
        message: `Could not resolve path mapping for "${importPath}"`
      });
      return false;
    }
    
    return true;
  }

  validateRelativeImport(fromFile, importPath, file, line) {
    const fromDir = path.dirname(fromFile);
    const resolvedPath = path.resolve(fromDir, importPath);
    
    if (this.fileExists(resolvedPath)) {
      return true;
    }
    
    this.errors.push({
      type: 'INVALID_RELATIVE_IMPORT',
      file,
      line,
      import: importPath,
      resolvedPath: path.relative(this.projectRoot, resolvedPath),
      message: `Cannot resolve relative import "${importPath}"`
    });
    return false;
  }

  fileExists(filePath) {
    // Try the exact path first
    if (fs.existsSync(filePath)) {
      return true;
    }
    
    // Try with common extensions
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
    for (const ext of extensions) {
      if (fs.existsSync(filePath + ext)) {
        return true;
      }
    }
    
    // Try index files in directory
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      for (const ext of extensions) {
        if (fs.existsSync(path.join(filePath, 'index' + ext))) {
          return true;
        }
      }
    }
    
    return false;
  }

  isBuiltinModule(moduleName) {
    const builtins = [
      'fs', 'path', 'crypto', 'http', 'https', 'url', 'querystring',
      'stream', 'util', 'events', 'buffer', 'child_process', 'os',
      'assert', 'cluster', 'dgram', 'dns', 'domain', 'net', 'punycode',
      'readline', 'repl', 'string_decoder', 'tls', 'tty', 'vm', 'zlib'
    ];
    return builtins.includes(moduleName);
  }

  generateReport() {
    console.log('\n📊 IMPORT VALIDATION REPORT');
    console.log('=' .repeat(50));
    
    // Statistics
    console.log(`📁 Files analyzed: ${this.stats.totalFiles}`);
    console.log(`🔗 Total imports: ${this.stats.totalImports}`);
    console.log(`✅ Valid imports: ${this.stats.validImports}`);
    console.log(`❌ Invalid imports: ${this.stats.invalidImports}`);
    
    if (this.stats.totalImports > 0) {
      const successRate = ((this.stats.validImports / this.stats.totalImports) * 100).toFixed(1);
      console.log(`📈 Success rate: ${successRate}%`);
    }
    
    // Errors
    if (this.errors.length > 0) {
      console.log('\n❌ VALIDATION ERRORS:');
      
      const errorsByType = {};
      this.errors.forEach(error => {
        if (!errorsByType[error.type]) {
          errorsByType[error.type] = [];
        }
        errorsByType[error.type].push(error);
      });
      
      Object.entries(errorsByType).forEach(([type, errors]) => {
        console.log(`\n   ${type} (${errors.length} errors):`);
        errors.forEach(error => {
          console.log(`     📄 ${error.file}:${error.line} - ${error.message}`);
          if (error.import) {
            console.log(`        Import: "${error.import}"`);
          }
        });
      });
    }
    
    // Warnings
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => {
        console.log(`   ${warning.message}`);
      });
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    if (this.errors.length === 0) {
      console.log('✅ All imports are valid!');
    } else {
      console.log(`❌ Found ${this.errors.length} import validation errors.`);
      console.log('\nTo fix import issues automatically, run:');
      console.log('   npm run deps:fix');
    }
    console.log('='.repeat(50));
  }
}

// Run the validator
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ImportValidator();
  validator.run().catch(error => {
    console.error('Error running import validation:', error);
    process.exit(1);
  });
}

export default ImportValidator;
