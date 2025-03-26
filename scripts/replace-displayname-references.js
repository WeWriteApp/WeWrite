const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files to exclude (React component displayName properties)
const EXCLUDE_PATTERNS = [
  'ui/',
  'Button.tsx',
  'Tooltip.tsx',
  'SlateEditor.js'
];

// Function to check if a file should be excluded
function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern));
}

// Function to replace displayName with username in a file
function replaceInFile(filePath) {
  try {
    // Skip excluded files
    if (shouldExcludeFile(filePath)) {
      console.log(`⏭️  Skipping excluded file: ${filePath}`);
      return false;
    }
    
    // Read file content
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Replace user.displayName with user.username
    content = content.replace(/user\.displayName/g, 'user.username');
    
    // Replace userData.displayName with userData.username
    content = content.replace(/userData\.displayName/g, 'userData.username');
    
    // Replace "displayName" in fallback patterns like "username || displayName"
    content = content.replace(/\|\|\s*(?:user(?:Data)?\.)?displayName/g, '');
    
    // Replace "displayName" in fallback patterns like "displayName || username"
    content = content.replace(/(?:user(?:Data)?\.)?displayName\s*\|\|/g, '');
    
    // Replace any remaining references to displayName related to user profiles
    // This is more complex and might need manual review
    
    // Only write if content changed
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return false;
  }
}

// Function to find and process files
async function processFiles() {
  try {
    console.log('🔍 Finding files with displayName references...');
    
    // Use grep to find files with displayName
    const grepCommand = "grep -r 'displayName' --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' /Users/jamesgray/Development/WeWrite/app";
    const grepResult = execSync(grepCommand).toString();
    
    // Extract unique file paths
    const filePaths = [...new Set(
      grepResult.split('\n')
        .filter(line => line.trim())
        .map(line => line.split(':')[0])
    )];
    
    console.log(`Found ${filePaths.length} files with displayName references`);
    
    // Process each file
    let updatedCount = 0;
    
    for (const filePath of filePaths) {
      if (replaceInFile(filePath)) {
        updatedCount++;
      }
    }
    
    console.log(`\n✅ Updated ${updatedCount} files`);
    console.log(`⏭️  Skipped ${filePaths.length - updatedCount} files (excluded or no changes needed)`);
    
    console.log('\n⚠️ IMPORTANT: Some complex references might need manual review.');
    console.log('   Please check the following files manually:');
    console.log('   - app/api/username/route.js');
    console.log('   - app/firebase/usernameHistory.js');
    console.log('   - Any files with complex displayName logic');
  } catch (error) {
    console.error('❌ Error during processing:', error);
  }
}

processFiles();
