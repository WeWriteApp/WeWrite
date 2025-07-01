#!/usr/bin/env node

/**
 * Import Organizer Script
 * 
 * Automatically organizes imports according to the established standards:
 * - Groups imports by type (external, internal, relative)
 * - Sorts imports alphabetically within groups
 * - Removes unused imports
 * - Standardizes import formatting
 * - Converts relative to absolute imports where appropriate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IMPORT_PATH_CONFIG, CONFIG_HELPERS } from './import-path-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImportOrganizer {
  constructor() {
    this.projectRoot = path.dirname(__dirname);
    this.config = IMPORT_PATH_CONFIG;
    this.stats = {
      filesProcessed: 0,
      importsOrganized: 0,
      unusedRemoved: 0,
      pathsConverted: 0,
      errors: 0
    };
    this.dryRun = process.argv.includes('--dry-run');
    this.verbose = process.argv.includes('--verbose');
  }

  async run() {
    console.log(`🔧 ${this.dryRun ? 'Analyzing' : 'Organizing'} imports...\n`);
    
    const files = this.getAllFiles();
    
    for (const filePath of files) {
      await this.processFile(filePath);
    }
    
    this.generateReport();
  }

  getAllFiles() {
    const files = [];
    
    const scanDir = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relativePath = path.relative(this.projectRoot, fullPath);
          
          // Skip excluded directories
          if (this.config.excludeDirectories.some(exclude => 
            relativePath.startsWith(exclude)
          )) {
            continue;
          }
          
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (CONFIG_HELPERS.shouldProcessFile(fullPath)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        if (this.verbose) {
          console.warn(`Warning: Could not scan ${dir}: ${error.message}`);
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
      
      const organizedContent = this.organizeImports(content, filePath);
      
      if (organizedContent !== content) {
        this.stats.filesProcessed++;
        
        if (!this.dryRun) {
          fs.writeFileSync(filePath, organizedContent);
        }
        
        if (this.verbose) {
          console.log(`✅ Organized: ${relativePath}`);
        }
      }
      
    } catch (error) {
      this.stats.errors++;
      if (this.verbose) {
        console.warn(`❌ Error processing ${path.relative(this.projectRoot, filePath)}: ${error.message}`);
      }
    }
  }

  organizeImports(content, filePath) {
    const lines = content.split('\n');
    const imports = this.extractImports(lines);
    
    if (imports.length === 0) {
      return content;
    }
    
    // Remove unused imports
    const usedImports = this.filterUsedImports(imports, content);
    this.stats.unusedRemoved += imports.length - usedImports.length;
    
    // Convert relative to absolute where appropriate
    const convertedImports = this.convertImportPaths(usedImports, filePath);
    
    // Group and sort imports
    const organizedImports = this.groupAndSortImports(convertedImports);
    
    // Generate new import section
    const newImportSection = this.generateImportSection(organizedImports);
    
    // Replace import section in content
    const newContent = this.replaceImportSection(lines, imports, newImportSection);
    
    this.stats.importsOrganized += organizedImports.length;
    
    return newContent;
  }

  extractImports(lines) {
    const imports = [];
    let inImportBlock = false;
    let currentImport = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip comments and empty lines at the top
      if (!line || line.startsWith('//') || line.startsWith('/*')) {
        continue;
      }
      
      // Check for import statement
      if (line.startsWith('import ') || line.startsWith('const ') && line.includes('require(')) {
        inImportBlock = true;
        currentImport = line;
        
        // Check if import is complete on this line
        if (this.isCompleteImport(line)) {
          imports.push({
            statement: currentImport,
            startLine: i,
            endLine: i,
            path: this.extractImportPath(currentImport)
          });
          currentImport = '';
          inImportBlock = false;
        }
      } else if (inImportBlock) {
        currentImport += ' ' + line;
        
        if (this.isCompleteImport(currentImport)) {
          imports.push({
            statement: currentImport,
            startLine: imports.length > 0 ? imports[imports.length - 1].endLine + 1 : i - currentImport.split(' ').length + 1,
            endLine: i,
            path: this.extractImportPath(currentImport)
          });
          currentImport = '';
          inImportBlock = false;
        }
      } else {
        // Stop looking for imports after first non-import statement
        break;
      }
    }
    
    return imports;
  }

  isCompleteImport(statement) {
    // Check for semicolon or complete require statement
    return statement.includes(';') || 
           (statement.includes('require(') && statement.includes(')'));
  }

  extractImportPath(statement) {
    // Extract path from import statement
    const match = statement.match(/['"`]([^'"`]+)['"`]/);
    return match ? match[1] : '';
  }

  filterUsedImports(imports, content) {
    return imports.filter(importItem => {
      const { statement, path: importPath } = importItem;
      
      // Extract imported names
      const importedNames = this.extractImportedNames(statement);
      
      // Check if any imported name is used in the content
      return importedNames.some(name => {
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        const matches = content.match(regex) || [];
        // Should appear more than once (once in import, once+ in usage)
        return matches.length > 1;
      });
    });
  }

  extractImportedNames(statement) {
    const names = [];
    
    // Handle different import patterns
    if (statement.includes('import {')) {
      // Named imports: import { a, b, c } from 'module'
      const match = statement.match(/import\s*\{\s*([^}]+)\s*\}/);
      if (match) {
        names.push(...match[1].split(',').map(name => 
          name.trim().split(' as ')[0].trim()
        ));
      }
    } else if (statement.includes('import * as')) {
      // Namespace import: import * as name from 'module'
      const match = statement.match(/import\s*\*\s*as\s+(\w+)/);
      if (match) {
        names.push(match[1]);
      }
    } else if (statement.includes('import ')) {
      // Default import: import name from 'module'
      const match = statement.match(/import\s+(\w+)/);
      if (match) {
        names.push(match[1]);
      }
    } else if (statement.includes('require(')) {
      // CommonJS: const name = require('module')
      const match = statement.match(/const\s+(\w+)/);
      if (match) {
        names.push(match[1]);
      }
    }
    
    return names;
  }

  convertImportPaths(imports, filePath) {
    return imports.map(importItem => {
      const { statement, path: importPath } = importItem;
      
      if (CONFIG_HELPERS.shouldUseAbsolute(importPath, filePath)) {
        const standardizedPath = CONFIG_HELPERS.getStandardizedPath(importPath);
        
        if (standardizedPath !== importPath) {
          this.stats.pathsConverted++;
          return {
            ...importItem,
            statement: statement.replace(importPath, standardizedPath),
            path: standardizedPath
          };
        }
      }
      
      return importItem;
    });
  }

  groupAndSortImports(imports) {
    const groups = {};
    
    // Initialize groups
    this.config.importGroups.forEach(group => {
      groups[group.name] = [];
    });
    
    // Categorize imports
    imports.forEach(importItem => {
      const group = CONFIG_HELPERS.getImportGroup(importItem.path);
      groups[group.name].push(importItem);
    });
    
    // Sort within each group
    Object.keys(groups).forEach(groupName => {
      groups[groupName].sort((a, b) => {
        // Sort by import path
        return a.path.localeCompare(b.path);
      });
    });
    
    return groups;
  }

  generateImportSection(groupedImports) {
    const sections = [];
    
    this.config.importGroups.forEach(group => {
      const imports = groupedImports[group.name];
      
      if (imports.length > 0) {
        const importStatements = imports.map(imp => imp.statement);
        sections.push(importStatements.join('\n'));
      }
    });
    
    return sections.join('\n\n');
  }

  replaceImportSection(lines, originalImports, newImportSection) {
    if (originalImports.length === 0) {
      return lines.join('\n');
    }
    
    const startLine = originalImports[0].startLine;
    const endLine = originalImports[originalImports.length - 1].endLine;
    
    // Replace the import section
    const beforeImports = lines.slice(0, startLine);
    const afterImports = lines.slice(endLine + 1);
    
    // Add empty line after imports if there isn't one
    const newLines = [
      ...beforeImports,
      ...newImportSection.split('\n'),
      '',
      ...afterImports
    ];
    
    return newLines.join('\n');
  }

  generateReport() {
    console.log('\n📊 IMPORT ORGANIZATION REPORT');
    console.log('=' .repeat(50));
    
    console.log(`📁 Files processed: ${this.stats.filesProcessed}`);
    console.log(`🔗 Imports organized: ${this.stats.importsOrganized}`);
    console.log(`🗑️  Unused imports removed: ${this.stats.unusedRemoved}`);
    console.log(`📏 Paths converted: ${this.stats.pathsConverted}`);
    console.log(`❌ Errors: ${this.stats.errors}`);
    
    console.log('\n' + '='.repeat(50));
    
    if (this.stats.filesProcessed === 0) {
      console.log('✅ No files needed import organization.');
    } else {
      console.log(`${this.dryRun ? '📋' : '✅'} ${this.dryRun ? 'Would organize' : 'Organized'} imports in ${this.stats.filesProcessed} files.`);
    }
    
    if (this.dryRun) {
      console.log('\nTo apply these changes, run: npm run organize:imports');
    }
    
    console.log('='.repeat(50));
  }
}

// Run the organizer
if (import.meta.url === `file://${process.argv[1]}`) {
  const organizer = new ImportOrganizer();
  organizer.run().catch(error => {
    console.error('Error organizing imports:', error);
    process.exit(1);
  });
}

export default ImportOrganizer;
