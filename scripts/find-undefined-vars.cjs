#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to find potential undefined variable references
 * Looks for patterns that might cause "user is not defined" or "session is not defined" errors
 */

// File extensions to search
const EXTENSIONS = ['.tsx', '.ts'];

// Directories to search
const SEARCH_DIRS = ['app/components', 'app/providers', 'app/hooks'];

// Files to exclude
const EXCLUDE_PATTERNS = ['node_modules', '.git', '.next', 'dist', 'build'];

// Patterns that might indicate undefined variables
const PROBLEMATIC_PATTERNS = [
  {
    pattern: /\buser\s*[?.](?!name|Id|Data|Ref|Snapshot|Email|Session|Profile|Info|Agent|Select)/g,
    description: 'Potential undefined "user" variable usage'
  },
  {
    pattern: /\bsession\s*[?.](?!Storage|Bag|Data)/g,
    description: 'Potential undefined "session" variable usage'
  },
  {
    pattern: /user\s*\?\s*[^:]/g,
    description: 'Ternary with undefined "user"'
  },
  {
    pattern: /session\s*\?\s*[^:]/g,
    description: 'Ternary with undefined "session"'
  },
  {
    pattern: /user\s*&&/g,
    description: 'Logical AND with undefined "user"'
  },
  {
    pattern: /session\s*&&/g,
    description: 'Logical AND with undefined "session"'
  }
];

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  if (!EXTENSIONS.includes(ext)) return false;
  
  for (const exclude of EXCLUDE_PATTERNS) {
    if (filePath.includes(exclude)) return false;
  }
  
  return true;
}

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    return fileList;
  }
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!EXCLUDE_PATTERNS.some(pattern => file.includes(pattern))) {
        getAllFiles(filePath, fileList);
      }
    } else if (shouldProcessFile(filePath)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const issues = [];
    
    for (const { pattern, description } of PROBLEMATIC_PATTERNS) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        const lineContent = lines[lineNumber - 1];
        
        // Skip if it's in a comment
        if (lineContent.includes('//') && lineContent.indexOf('//') < lineContent.indexOf(match[0])) {
          continue;
        }
        
        // Skip if it's in a string literal
        if (isInStringLiteral(lineContent, lineContent.indexOf(match[0]))) {
          continue;
        }
        
        issues.push({
          line: lineNumber,
          content: lineContent.trim(),
          match: match[0],
          description
        });
      }
    }
    
    return issues;
  } catch (error) {
    console.error(`❌ Error analyzing ${filePath}:`, error.message);
    return [];
  }
}

function isInStringLiteral(line, position) {
  let inString = false;
  let stringChar = null;
  let escaped = false;
  
  for (let i = 0; i < position; i++) {
    const char = line[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      continue;
    }
    
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar) {
      inString = false;
      stringChar = null;
    }
  }
  
  return inString;
}

function main() {
  console.log('🔍 Searching for potential undefined variable references...\n');
  
  let totalFiles = 0;
  let filesWithIssues = 0;
  let totalIssues = 0;
  
  for (const searchPath of SEARCH_DIRS) {
    console.log(`📁 Analyzing: ${searchPath}`);
    
    const files = getAllFiles(searchPath);
    totalFiles += files.length;
    
    for (const file of files) {
      const issues = analyzeFile(file);
      
      if (issues.length > 0) {
        filesWithIssues++;
        totalIssues += issues.length;
        
        console.log(`\n⚠️  ${file}:`);
        issues.forEach(issue => {
          console.log(`   Line ${issue.line}: ${issue.description}`);
          console.log(`   Code: ${issue.content}`);
          console.log(`   Match: "${issue.match}"`);
          console.log('');
        });
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total files analyzed: ${totalFiles}`);
  console.log(`   Files with potential issues: ${filesWithIssues}`);
  console.log(`   Total potential issues: ${totalIssues}`);
  
  if (totalIssues === 0) {
    console.log(`\n✅ No obvious undefined variable patterns found!`);
  } else {
    console.log(`\n⚠️  Found ${totalIssues} potential undefined variable issues.`);
    console.log(`Please review the above findings and fix any actual undefined variables.`);
  }
}

main();
