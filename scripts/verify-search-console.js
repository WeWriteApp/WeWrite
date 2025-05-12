/**
 * Google Search Console Verification Helper
 * 
 * This script helps you verify your site with Google Search Console
 * by providing instructions and checking your setup.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n=== Google Search Console Verification Helper ===\n');
console.log('This script will help you verify your site with Google Search Console.\n');

// Check if robots.txt exists
const robotsPath = path.join(__dirname, '../public/robots.txt');
const robotsExists = fs.existsSync(robotsPath);

console.log(`1. Robots.txt: ${robotsExists ? '✅ Found' : '❌ Not found'}`);
if (robotsExists) {
  const robotsContent = fs.readFileSync(robotsPath, 'utf8');
  console.log('   - Content preview:');
  console.log('   ' + robotsContent.split('\n').slice(0, 3).join('\n   ') + '...');
}

// Check if sitemap.xml exists
const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
const sitemapExists = fs.existsSync(sitemapPath);

console.log(`\n2. Sitemap.xml: ${sitemapExists ? '✅ Found' : '❌ Not found'}`);
if (sitemapExists) {
  const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  console.log('   - Content preview:');
  console.log('   ' + sitemapContent.split('\n').slice(0, 3).join('\n   ') + '...');
}

// Check if dynamic sitemap.ts exists
const dynamicSitemapPath = path.join(__dirname, '../app/sitemap.ts');
const dynamicSitemapExists = fs.existsSync(dynamicSitemapPath);

console.log(`\n3. Dynamic sitemap.ts: ${dynamicSitemapExists ? '✅ Found' : '❌ Not found'}`);

// Check if Google verification file exists
const verificationPath = path.join(__dirname, '../public/google-site-verification.html');
const verificationExists = fs.existsSync(verificationPath);

console.log(`\n4. Google verification file: ${verificationExists ? '✅ Found' : '❌ Not found'}`);
if (verificationExists) {
  const verificationContent = fs.readFileSync(verificationPath, 'utf8');
  const verificationCode = verificationContent.match(/content="([^"]+)"/);
  console.log(`   - Verification code: ${verificationCode ? verificationCode[1] : 'Not found in file'}`);
}

// Check if verification is in layout.tsx
const layoutPath = path.join(__dirname, '../app/layout.tsx');
const layoutExists = fs.existsSync(layoutPath);

console.log(`\n5. Verification in layout.tsx: ${layoutExists ? '✅ File found' : '❌ File not found'}`);
if (layoutExists) {
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  const hasVerification = layoutContent.includes('verification:');
  console.log(`   - Verification meta tag: ${hasVerification ? '✅ Found' : '❌ Not found'}`);
}

console.log('\n=== Next Steps ===\n');
console.log('1. Go to Google Search Console: https://search.google.com/search-console');
console.log('2. Add your property (URL prefix or domain)');
console.log('3. Choose one of these verification methods:');
console.log('   - HTML file: Upload the google-site-verification.html file to your site');
console.log('   - HTML tag: Add the verification meta tag to your layout.tsx file');
console.log('   - DNS record: Add a TXT record to your domain');
console.log('4. After verification, submit your sitemap.xml');
console.log('5. Wait for Google to crawl your site (can take days or weeks)');

rl.question('\nDo you want to update your Google verification code? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    rl.question('Enter your Google verification code: ', (code) => {
      // Update verification file
      if (verificationExists) {
        let content = fs.readFileSync(verificationPath, 'utf8');
        content = content.replace(/content="[^"]+"/, `content="${code}"`);
        fs.writeFileSync(verificationPath, content);
        console.log('✅ Updated verification file');
      } else {
        const verificationContent = `<!DOCTYPE html>
<html>
<head>
  <title>Google Search Console Verification</title>
  <meta name="google-site-verification" content="${code}" />
</head>
<body>
  Google Search Console verification page
</body>
</html>`;
        fs.writeFileSync(verificationPath, verificationContent);
        console.log('✅ Created verification file');
      }

      // Update layout.tsx
      if (layoutExists) {
        let content = fs.readFileSync(layoutPath, 'utf8');
        if (content.includes('verification:')) {
          content = content.replace(/google: [^,}]+/, `google: "${code}"`);
        } else {
          console.log('❌ Could not update layout.tsx - verification section not found');
        }
        fs.writeFileSync(layoutPath, content);
        console.log('✅ Updated layout.tsx');
      }

      console.log('\n✅ Verification code updated successfully!');
      rl.close();
    });
  } else {
    console.log('\nNo changes made. You can run this script again when you have your verification code.');
    rl.close();
  }
});
