#!/usr/bin/env node

/**
 * CRITICAL FIX - Find and fix all remaining 'user' references that should be 'session'
 */

import fs from 'fs';
import path from 'path';

function findAllFilesWithUserReferences(dir = 'app', files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(item)) {
        findAllFilesWithUserReferences(fullPath, files);
      }
    } else if (stat.isFile() && /\.(js|jsx|ts|tsx)$/.test(item)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Look for 'user' references that are likely auth-related
      if (content.includes('user ?') || 
          content.includes('user.uid') || 
          content.includes('user.email') ||
          content.includes('user.displayName') ||
          content.includes('user &&') ||
          content.includes('!user') ||
          content.includes('(user)') ||
          content.includes('user,') ||
          content.includes('user)') ||
          content.includes('user]')) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function fixUserReferences(filePath) {
  console.log(`🚨 CRITICAL FIX: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;

  // Critical fixes for user references
  const fixes = [
    // Fix conditional checks
    { from: /\buser\s*\?\s*session\.uid/g, to: 'session?.uid' },
    { from: /\buser\s*\?\s*session\./g, to: 'session?.' },
    { from: /\buser\s*\?\s*user\./g, to: 'session?.' },
    
    // Fix property access
    { from: /\buser\.uid\b/g, to: 'session.uid' },
    { from: /\buser\.email\b/g, to: 'session.email' },
    { from: /\buser\.displayName\b/g, to: 'session.displayName' },
    { from: /\buser\.photoURL\b/g, to: 'session.photoURL' },
    { from: /\buser\.emailVerified\b/g, to: 'session.emailVerified' },
    { from: /\buser\.username\b/g, to: 'session.username' },
    
    // Fix conditional expressions
    { from: /!\s*user\b/g, to: '!session' },
    { from: /\buser\s*&&/g, to: 'session &&' },
    { from: /&&\s*user\b/g, to: '&& session' },
    { from: /\(\s*user\s*\)/g, to: '(session)' },
    
    // Fix function parameters and array elements
    { from: /,\s*user\s*,/g, to: ', session,' },
    { from: /,\s*user\s*\]/g, to: ', session]' },
    { from: /,\s*user\s*\)/g, to: ', session)' },
    { from: /\[\s*user\s*,/g, to: '[session,' },
    { from: /\[\s*user\s*\]/g, to: '[session]' },
    
    // Fix specific patterns
    { from: /user\s*\?\s*user\./g, to: 'session?.' },
    { from: /\buser\?\./g, to: 'session?.' }
  ];

  fixes.forEach((fix, index) => {
    const newContent = content.replace(fix.from, fix.to);
    if (newContent !== content) {
      content = newContent;
      hasChanges = true;
      console.log(`  ✅ Applied fix ${index + 1}: ${fix.from.source || fix.from}`);
    }
  });

  if (hasChanges) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ FIXED: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`);
    return false;
  }
}

function main() {
  console.log('🚨 CRITICAL USER REFERENCE FIX - FINDING ALL FILES\n');
  
  const userFiles = findAllFilesWithUserReferences();
  
  console.log(`Found ${userFiles.length} files with user references:`);
  userFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');
  
  if (userFiles.length === 0) {
    console.log('✅ No files found with user references!');
    return;
  }
  
  console.log('🚀 APPLYING CRITICAL FIXES...\n');
  
  let totalFixed = 0;
  
  userFiles.forEach(file => {
    if (fixUserReferences(file)) {
      totalFixed++;
    }
    console.log('');
  });
  
  console.log(`📊 CRITICAL FIX SUMMARY:`);
  console.log(`   Files found: ${userFiles.length}`);
  console.log(`   Files fixed: ${totalFixed}`);
  
  console.log('\n✅ CRITICAL FIXES COMPLETE!');
}

// Run immediately
main();
