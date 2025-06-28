#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Find all TypeScript files in app/services that contain "new FinancialError("
function findFilesWithFinancialError() {
  const servicesDir = path.join(__dirname, 'app', 'services');
  const files = [];
  
  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.endsWith('.ts')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('new FinancialError(')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scanDirectory(servicesDir);
  return files;
}

// Fix FinancialError constructor calls in a file
function fixFinancialErrorsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;
  
  // Pattern 1: new FinancialError(code, message, retryable, details)
  const pattern1 = /new FinancialError\(\s*([^,]+),\s*([^,]+),\s*(true|false),\s*\{([^}]*correlationId:\s*([^,}]+)[^}]*)\}\s*\)/g;
  content = content.replace(pattern1, (match, code, message, retryable, details, correlationId) => {
    changes++;
    // Extract correlationId and clean up details
    const cleanDetails = details.replace(/correlationId:\s*[^,}]+,?\s*/, '').replace(/^,\s*/, '').replace(/,\s*$/, '');
    const detailsStr = cleanDetails.trim() ? `{ ${cleanDetails} }` : '';
    
    return `FinancialUtils.createError(${code}, ${message}, ${correlationId}, ${retryable}${detailsStr ? `, ${detailsStr}` : ''})`;
  });
  
  // Pattern 2: new FinancialError(code, message, retryable, { correlationId, ... })
  const pattern2 = /new FinancialError\(\s*([^,]+),\s*([^,]+),\s*(true|false),\s*\{\s*correlationId:\s*([^,}]+)([^}]*)\}\s*\)/g;
  content = content.replace(pattern2, (match, code, message, retryable, correlationId, restDetails) => {
    changes++;
    const cleanDetails = restDetails.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
    const detailsStr = cleanDetails ? `{ ${cleanDetails} }` : '';
    
    return `FinancialUtils.createError(${code}, ${message}, ${correlationId}, ${retryable}${detailsStr ? `, ${detailsStr}` : ''})`;
  });
  
  // Pattern 3: Simple new FinancialError(code, message, retryable, correlationId) - no details object
  const pattern3 = /new FinancialError\(\s*([^,]+),\s*([^,]+),\s*(true|false),\s*([^,{][^)]*)\)/g;
  content = content.replace(pattern3, (match, code, message, retryable, correlationId) => {
    changes++;
    return `FinancialUtils.createError(${code}, ${message}, ${correlationId.trim()}, ${retryable})`;
  });
  
  if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${changes} FinancialError constructor calls in ${path.relative(__dirname, filePath)}`);
  }
  
  return changes;
}

// Main execution
function main() {
  console.log('Finding files with FinancialError constructor calls...');
  const files = findFilesWithFinancialError();
  
  console.log(`Found ${files.length} files with FinancialError constructor calls`);
  
  let totalChanges = 0;
  for (const file of files) {
    const changes = fixFinancialErrorsInFile(file);
    totalChanges += changes;
  }
  
  console.log(`\nTotal changes made: ${totalChanges}`);
  console.log('All FinancialError constructor calls have been updated to use FinancialUtils.createError()');
}

if (require.main === module) {
  main();
}
