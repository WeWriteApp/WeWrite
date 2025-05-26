#!/usr/bin/env node

/**
 * Test script to verify all adminOnly logic has been removed from the feature flag system
 */

console.log('🧪 Testing adminOnly logic removal...');

// Test 1: Check interface definitions
function testInterfaceDefinitions() {
  console.log('\n1. Testing interface definitions...');
  
  const filesToCheck = [
    './app/components/AdminPanel.tsx',
    './app/admin/page.tsx',
    './app/hooks/useFeatureFlags.ts'
  ];
  
  filesToCheck.forEach(filePath => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes('adminOnly: boolean')) {
        console.log(`❌ ${filePath} still has adminOnly in interface`);
      } else {
        console.log(`✅ ${filePath} interface cleaned`);
      }
    } catch (error) {
      console.log(`❌ Error reading ${filePath}:`, error.message);
    }
  });
}

// Test 2: Check feature flag definitions
function testFeatureFlagDefinitions() {
  console.log('\n2. Testing feature flag definitions...');
  
  const filesToCheck = [
    './app/components/AdminPanel.tsx',
    './app/admin/page.tsx',
    './app/hooks/useFeatureFlags.ts'
  ];
  
  filesToCheck.forEach(filePath => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes('adminOnly: true') || content.includes('adminOnly: false')) {
        console.log(`❌ ${filePath} still has adminOnly properties`);
      } else {
        console.log(`✅ ${filePath} adminOnly properties removed`);
      }
    } catch (error) {
      console.log(`❌ Error reading ${filePath}:`, error.message);
    }
  });
}

// Test 3: Check for "Admin Only" badges/chips
function testAdminOnlyBadges() {
  console.log('\n3. Testing "Admin Only" badges/chips...');
  
  const filesToCheck = [
    './app/components/AdminPanel.tsx',
    './app/admin/page.tsx'
  ];
  
  filesToCheck.forEach(filePath => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes('Admin Only') || content.includes('adminOnly &&')) {
        console.log(`❌ ${filePath} still has "Admin Only" badges or conditional logic`);
      } else {
        console.log(`✅ ${filePath} "Admin Only" badges removed`);
      }
    } catch (error) {
      console.log(`❌ Error reading ${filePath}:`, error.message);
    }
  });
}

// Test 4: Check for system string names vs display names
function testSystemStringNames() {
  console.log('\n4. Testing system string names vs display names...');
  
  const filesToCheck = [
    './app/components/AdminPanel.tsx',
    './app/admin/page.tsx'
  ];
  
  filesToCheck.forEach(filePath => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if we're using system names instead of display names
      const hasSystemNames = content.includes("name: 'payments'") && 
                            content.includes("name: 'username_management'") &&
                            content.includes("name: 'groups'");
      
      const hasDisplayNames = content.includes("name: 'Payments'") || 
                             content.includes("name: 'Username Management'") ||
                             content.includes("name: 'Groups'");
      
      if (hasSystemNames && !hasDisplayNames) {
        console.log(`✅ ${filePath} uses system string names`);
      } else if (hasDisplayNames) {
        console.log(`❌ ${filePath} still uses display names instead of system strings`);
      } else {
        console.log(`⚠️  ${filePath} feature flag names not found or unclear`);
      }
    } catch (error) {
      console.log(`❌ Error reading ${filePath}:`, error.message);
    }
  });
}

// Test 5: Check for any remaining adminOnly references
function testRemainingAdminOnlyReferences() {
  console.log('\n5. Testing for any remaining adminOnly references...');
  
  const filesToCheck = [
    './app/components/AdminPanel.tsx',
    './app/admin/page.tsx',
    './app/hooks/useFeatureFlags.ts',
    './app/utils/feature-flags.ts'
  ];
  
  filesToCheck.forEach(filePath => {
    try {
      const fs = require('fs');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Count adminOnly references (case insensitive)
      const adminOnlyMatches = content.match(/adminonly|admin_only|adminOnly/gi);
      
      if (adminOnlyMatches && adminOnlyMatches.length > 0) {
        console.log(`❌ ${filePath} still has ${adminOnlyMatches.length} adminOnly references: ${adminOnlyMatches.join(', ')}`);
      } else {
        console.log(`✅ ${filePath} no adminOnly references found`);
      }
    } catch (error) {
      console.log(`❌ Error reading ${filePath}:`, error.message);
    }
  });
}

// Run all tests
testInterfaceDefinitions();
testFeatureFlagDefinitions();
testAdminOnlyBadges();
testSystemStringNames();
testRemainingAdminOnlyReferences();

console.log('\n🎉 AdminOnly removal test completed!');
console.log('\n📝 Summary:');
console.log('- All adminOnly properties should be removed from interfaces and definitions');
console.log('- All "Admin Only" badges/chips should be removed from UI');
console.log('- Admin panel should show system string names (like "payments") instead of display names');
console.log('- Feature flags should work purely based on admin toggle settings');
console.log('- No competing adminOnly logic should interfere with toggle functionality');
