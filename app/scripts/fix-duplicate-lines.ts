#!/usr/bin/env tsx

/**
 * Fix Duplicate Lines Script
 * 
 * This script finds and removes duplicate lines that were created by the
 * environment bypass fix script.
 */

import * as fs from 'fs';
import * as path from 'path';

// Files to scan (TypeScript files)
const SCAN_DIRECTORIES = [
  'app/firebase',
  'app/api',
  'app/services',
  'app/utils'
];

// Files to exclude from scanning
const EXCLUDE_FILES = [
  'fix-duplicate-lines.ts',
  'fix-environment-bypasses.ts',
  'test-environment-config.ts'
];

interface DuplicateIssue {
  file: string;
  line1: number;
  line2: number;
  content: string;
}

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...findTypeScriptFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (!EXCLUDE_FILES.some(exclude => entry.name.includes(exclude))) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function findDuplicateLines(filePath: string): DuplicateIssue[] {
  const issues: DuplicateIssue[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i].trim();
      const nextLine = lines[i + 1].trim();
      
      // Skip empty lines
      if (!currentLine || !nextLine) continue;
      
      // Check if consecutive lines are identical
      if (currentLine === nextLine) {
        // Check for specific patterns that indicate duplicates from our fix script
        if (
          currentLine.includes('collection(db,') ||
          currentLine.includes('doc(db,') ||
          currentLine.includes('getCollectionName') ||
          currentLine.includes('import { getCollectionName')
        ) {
          issues.push({
            file: filePath,
            line1: i + 1,
            line2: i + 2,
            content: currentLine
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning file ${filePath}:`, error);
  }
  
  return issues;
}

function fixDuplicateLines(filePath: string, issues: DuplicateIssue[]): void {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Sort issues by line number in descending order to avoid line number shifts
    const sortedIssues = issues.sort((a, b) => b.line2 - a.line2);
    
    for (const issue of sortedIssues) {
      // Remove the duplicate line (line2)
      const lineIndex = issue.line2 - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines.splice(lineIndex, 1);
        console.log(`   Removed duplicate line ${issue.line2}: ${issue.content.substring(0, 60)}...`);
      }
    }
    
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`✅ Fixed ${issues.length} duplicate lines in ${filePath}`);
  } catch (error) {
    console.error(`Error fixing file ${filePath}:`, error);
  }
}

async function main() {
  const shouldFix = process.argv.includes('--fix');
  
  console.log('🔍 Scanning for duplicate lines...\n');
  
  const allIssues: DuplicateIssue[] = [];
  
  // Scan all directories
  for (const dir of SCAN_DIRECTORIES) {
    const files = findTypeScriptFiles(dir);
    console.log(`Scanning ${files.length} files in ${dir}...`);
    
    for (const file of files) {
      const issues = findDuplicateLines(file);
      allIssues.push(...issues);
    }
  }
  
  if (allIssues.length === 0) {
    console.log('✅ No duplicate lines found!');
    return;
  }
  
  console.log(`\n🚨 Found ${allIssues.length} duplicate lines:\n`);
  
  // Group issues by file
  const issuesByFile = allIssues.reduce((acc, issue) => {
    if (!acc[issue.file]) {
      acc[issue.file] = [];
    }
    acc[issue.file].push(issue);
    return acc;
  }, {} as Record<string, DuplicateIssue[]>);
  
  if (!shouldFix) {
    // Display summary
    Object.entries(issuesByFile).forEach(([file, issues]) => {
      console.log(`📄 ${file.replace(process.cwd() + '/', '')}`);
      issues.forEach(issue => {
        console.log(`   Lines ${issue.line1}-${issue.line2}: ${issue.content.substring(0, 80)}...`);
      });
      console.log();
    });
    
    console.log('\n🔧 To fix these issues, run the script with --fix flag');
    console.log('   npx tsx app/scripts/fix-duplicate-lines.ts --fix');
    return;
  }
  
  // Fix mode
  console.log('🔧 Fixing duplicate lines...\n');
  
  let fixedFiles = 0;
  let fixedIssues = 0;
  
  for (const [file, issues] of Object.entries(issuesByFile)) {
    console.log(`📄 Fixing ${file.replace(process.cwd() + '/', '')} (${issues.length} duplicates)`);
    
    // Fix all issues in the file
    fixDuplicateLines(file, issues);
    
    fixedFiles++;
    fixedIssues += issues.length;
  }
  
  console.log(`\n✅ Fixed ${fixedIssues} duplicate lines across ${fixedFiles} files!`);
  console.log('\n🧪 Test the application to verify fixes work correctly.');
}

if (require.main === module) {
  main().catch(console.error);
}
