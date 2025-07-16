#!/usr/bin/env tsx

/**
 * Fix Environment Configuration Bypasses
 * 
 * This script automatically finds and fixes all direct Firebase collection references
 * that bypass the environment configuration system.
 */

import * as fs from 'fs';
import * as path from 'path';

interface BypassIssue {
  file: string;
  line: number;
  content: string;
  type: 'collection' | 'doc' | 'subcollection';
  collectionName: string;
}

// Patterns to find direct Firebase collection references
const BYPASS_PATTERNS = [
  // collection(db, "collectionName")
  /collection\(db,\s*["']([^"']+)["']\)/g,
  // doc(db, "collectionName", docId)
  /doc\(db,\s*["']([^"']+)["'],\s*[^)]+\)/g,
  // collection(db, "pages", pageId, "versions") - subcollections
  /collection\(db,\s*["']([^"']+)["'],\s*[^,]+,\s*["']([^"']+)["']\)/g,
];

// Collections that should use environment-aware naming
const ENVIRONMENT_COLLECTIONS = [
  'users', 'pages', 'activities', 'config', 'subscriptions',
  'tokenBalances', 'tokenAllocations', 'tokenEarnings',
  'writerTokenBalances', 'writerTokenEarnings', 'tokenPayouts',
  'payouts', 'payoutRequests', 'transactions', 'paymentRecovery',
  'usernames', 'backlinks', 'siteVisitors', 'featureOverrides',
  'readingHistory', 'sessions', 'pledges', 'analytics_counters',
  'analytics_daily'
];

// Files to scan (Firebase-related files)
const SCAN_DIRECTORIES = [
  'app/firebase',
  'app/api',
  'app/services',
  'app/utils'
];

// Files to exclude from scanning
const EXCLUDE_FILES = [
  'fix-environment-bypasses.ts',
  'test-environment-config.ts',
  'environmentConfig.ts',
  'environmentDetection.ts'
];

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

function scanFileForBypasses(filePath: string): BypassIssue[] {
  const issues: BypassIssue[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for collection(db, "collectionName")
      const collectionMatches = line.matchAll(/collection\(db,\s*["']([^"']+)["']\)/g);
      for (const match of collectionMatches) {
        const collectionName = match[1];
        if (ENVIRONMENT_COLLECTIONS.includes(collectionName)) {
          issues.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            type: 'collection',
            collectionName
          });
        }
      }
      
      // Check for doc(db, "collectionName", ...)
      const docMatches = line.matchAll(/doc\(db,\s*["']([^"']+)["'],/g);
      for (const match of docMatches) {
        const collectionName = match[1];
        if (ENVIRONMENT_COLLECTIONS.includes(collectionName)) {
          issues.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            type: 'doc',
            collectionName
          });
        }
      }
      
      // Check for subcollection patterns: collection(db, "pages", pageId, "versions")
      const subCollectionMatches = line.matchAll(/collection\(db,\s*["']([^"']+)["'],\s*[^,]+,\s*["']([^"']+)["']\)/g);
      for (const match of subCollectionMatches) {
        const parentCollection = match[1];
        if (ENVIRONMENT_COLLECTIONS.includes(parentCollection)) {
          issues.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            type: 'subcollection',
            collectionName: parentCollection
          });
        }
      }
    });
  } catch (error) {
    console.error(`Error scanning file ${filePath}:`, error);
  }
  
  return issues;
}

function generateFix(issue: BypassIssue): string {
  const { type, content, collectionName } = issue;
  
  switch (type) {
    case 'collection':
      return content.replace(
        `collection(db, "${collectionName}")`,
        `collection(db, getCollectionName("${collectionName}"))`
      );
      
    case 'doc':
      return content.replace(
        new RegExp(`doc\\(db,\\s*["']${collectionName}["'],`),
        `doc(db, getCollectionName("${collectionName}"),`
      );
      
    case 'subcollection':
      return content.replace(
        new RegExp(`collection\\(db,\\s*["']${collectionName}["'],`),
        `collection(db, getCollectionName("${collectionName}"),`
      );
      
    default:
      return content;
  }
}

function checkImportExists(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.includes('getCollectionName') && content.includes('environmentConfig');
  } catch {
    return false;
  }
}

function addImportIfNeeded(filePath: string): void {
  if (checkImportExists(filePath)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Find the last import statement
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ') && !lines[i].includes('//')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      // Calculate relative path to environmentConfig
      const relativePath = calculateRelativePath(filePath);
      lines.splice(lastImportIndex + 1, 0, `import { getCollectionName } from "${relativePath}";`);
      fs.writeFileSync(filePath, lines.join('\n'));
      console.log(`✅ Added import to ${filePath}`);
    }
  } catch (error) {
    console.error(`Error adding import to ${filePath}:`, error);
  }
}

function calculateRelativePath(filePath: string): string {
  const depth = filePath.split('/').length - 2; // -2 for 'app' and filename
  const upLevels = '../'.repeat(depth);
  return `${upLevels}utils/environmentConfig`;
}

function fixFileIssues(filePath: string, issues: BypassIssue[]): void {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Sort issues by line number in descending order to avoid line number shifts
    const sortedIssues = issues.sort((a, b) => b.line - a.line);

    for (const issue of sortedIssues) {
      const lineIndex = issue.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const originalLine = lines[lineIndex];
        const fixedLine = generateFix(issue);
        lines[lineIndex] = fixedLine;
        console.log(`   Fixed line ${issue.line}: ${issue.type} - ${issue.collectionName}`);
      }
    }

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`✅ Fixed ${issues.length} issues in ${filePath}`);
  } catch (error) {
    console.error(`Error fixing file ${filePath}:`, error);
  }
}

async function main() {
  const shouldFix = process.argv.includes('--fix');

  console.log('🔍 Scanning for environment configuration bypasses...\n');

  const allIssues: BypassIssue[] = [];

  // Scan all directories
  for (const dir of SCAN_DIRECTORIES) {
    const files = findTypeScriptFiles(dir);
    console.log(`Scanning ${files.length} files in ${dir}...`);

    for (const file of files) {
      const issues = scanFileForBypasses(file);
      allIssues.push(...issues);
    }
  }

  if (allIssues.length === 0) {
    console.log('✅ No environment configuration bypasses found!');
    return;
  }

  console.log(`\n🚨 Found ${allIssues.length} environment configuration bypasses:\n`);

  // Group issues by file
  const issuesByFile = allIssues.reduce((acc, issue) => {
    if (!acc[issue.file]) {
      acc[issue.file] = [];
    }
    acc[issue.file].push(issue);
    return acc;
  }, {} as Record<string, BypassIssue[]>);

  if (!shouldFix) {
    // Display summary
    Object.entries(issuesByFile).forEach(([file, issues]) => {
      console.log(`📄 ${file.replace(process.cwd() + '/', '')}`);
      issues.forEach(issue => {
        console.log(`   Line ${issue.line}: ${issue.type} - ${issue.collectionName}`);
        console.log(`   ${issue.content}`);
      });
      console.log();
    });

    console.log('\n🔧 To fix these issues, run the script with --fix flag');
    console.log('   npx tsx app/scripts/fix-environment-bypasses.ts --fix');
    return;
  }

  // Fix mode
  console.log('🔧 Fixing environment configuration bypasses...\n');

  let fixedFiles = 0;
  let fixedIssues = 0;

  for (const [file, issues] of Object.entries(issuesByFile)) {
    console.log(`📄 Fixing ${file.replace(process.cwd() + '/', '')} (${issues.length} issues)`);

    // Add import if needed
    addImportIfNeeded(file);

    // Fix all issues in the file
    fixFileIssues(file, issues);

    fixedFiles++;
    fixedIssues += issues.length;
  }

  console.log(`\n✅ Fixed ${fixedIssues} issues across ${fixedFiles} files!`);
  console.log('\n🧪 Run the test script to verify fixes:');
  console.log('   npx tsx app/scripts/test-environment-config.ts');
}

if (require.main === module) {
  main().catch(console.error);
}
