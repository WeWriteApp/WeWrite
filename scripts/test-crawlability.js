/**
 * Search Engine Crawlability Test
 * 
 * This script tests if your site is properly crawlable by search engines
 * by checking various aspects of your site's SEO setup.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app';

console.log('\n=== Search Engine Crawlability Test ===\n');
console.log(`Testing site: ${baseUrl}\n`);

// Check if robots.txt is accessible
function checkRobotsTxt() {
  return new Promise((resolve) => {
    console.log('1. Testing robots.txt...');
    
    https.get(`${baseUrl}/robots.txt`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('   ✅ robots.txt is accessible');
          console.log('   - Status code: 200');
          console.log('   - Content preview:');
          console.log('   ' + data.split('\n').slice(0, 3).join('\n   ') + '...');
          resolve(true);
        } else {
          console.log('   ❌ robots.txt is not accessible');
          console.log('   - Status code:', res.statusCode);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log('   ❌ Error accessing robots.txt:', err.message);
      resolve(false);
    });
  });
}

// Check if sitemap.xml is accessible
function checkSitemapXml() {
  return new Promise((resolve) => {
    console.log('\n2. Testing sitemap.xml...');
    
    https.get(`${baseUrl}/sitemap.xml`, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('   ✅ sitemap.xml is accessible');
          console.log('   - Status code: 200');
          console.log('   - Content preview:');
          console.log('   ' + data.split('\n').slice(0, 3).join('\n   ') + '...');
          
          // Check if sitemap is valid XML
          if (data.trim().startsWith('<?xml')) {
            console.log('   ✅ sitemap.xml is valid XML');
          } else {
            console.log('   ❌ sitemap.xml is not valid XML');
          }
          
          resolve(true);
        } else {
          console.log('   ❌ sitemap.xml is not accessible');
          console.log('   - Status code:', res.statusCode);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log('   ❌ Error accessing sitemap.xml:', err.message);
      resolve(false);
    });
  });
}

// Check if the homepage has proper meta tags
function checkMetaTags() {
  return new Promise((resolve) => {
    console.log('\n3. Testing meta tags on homepage...');
    
    https.get(baseUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('   ✅ Homepage is accessible');
          console.log('   - Status code: 200');
          
          // Check for title tag
          const titleMatch = data.match(/<title>(.*?)<\/title>/i);
          if (titleMatch) {
            console.log('   ✅ Title tag found:', titleMatch[1]);
          } else {
            console.log('   ❌ Title tag not found');
          }
          
          // Check for description meta tag
          const descriptionMatch = data.match(/<meta name="description" content="(.*?)"/i);
          if (descriptionMatch) {
            console.log('   ✅ Description meta tag found');
          } else {
            console.log('   ❌ Description meta tag not found');
          }
          
          // Check for canonical URL
          const canonicalMatch = data.match(/<link rel="canonical" href="(.*?)"/i);
          if (canonicalMatch) {
            console.log('   ✅ Canonical URL found:', canonicalMatch[1]);
          } else {
            console.log('   ❌ Canonical URL not found');
          }
          
          // Check for Open Graph tags
          const ogTitleMatch = data.match(/<meta property="og:title" content="(.*?)"/i);
          if (ogTitleMatch) {
            console.log('   ✅ Open Graph title found');
          } else {
            console.log('   ❌ Open Graph title not found');
          }
          
          // Check for Twitter Card tags
          const twitterCardMatch = data.match(/<meta name="twitter:card" content="(.*?)"/i);
          if (twitterCardMatch) {
            console.log('   ✅ Twitter Card found:', twitterCardMatch[1]);
          } else {
            console.log('   ❌ Twitter Card not found');
          }
          
          resolve(true);
        } else {
          console.log('   ❌ Homepage is not accessible');
          console.log('   - Status code:', res.statusCode);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log('   ❌ Error accessing homepage:', err.message);
      resolve(false);
    });
  });
}

// Check if Google can access your site
function checkGooglebot() {
  return new Promise((resolve) => {
    console.log('\n4. Testing Googlebot access...');
    console.log('   This is a simulated test. In reality, you should check Google Search Console.');
    
    // Check if robots.txt blocks Googlebot
    const robotsPath = path.join(__dirname, '../public/robots.txt');
    if (fs.existsSync(robotsPath)) {
      const robotsContent = fs.readFileSync(robotsPath, 'utf8');
      if (robotsContent.includes('User-agent: Googlebot') && robotsContent.includes('Disallow: /')) {
        console.log('   ❌ robots.txt blocks Googlebot from crawling your site');
      } else {
        console.log('   ✅ robots.txt does not block Googlebot');
      }
    }
    
    console.log('   ℹ️ To properly test Googlebot access:');
    console.log('   1. Go to Google Search Console');
    console.log('   2. Use the URL Inspection tool');
    console.log('   3. Check if your pages can be indexed');
    
    resolve(true);
  });
}

// Check if your site has a valid SSL certificate
function checkSSL() {
  return new Promise((resolve) => {
    console.log('\n5. Testing SSL certificate...');
    
    const domain = new URL(baseUrl).hostname;
    
    exec(`echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -dates`, (error, stdout, stderr) => {
      if (error) {
        console.log('   ❌ Error checking SSL certificate:', error.message);
        resolve(false);
        return;
      }
      
      if (stderr) {
        console.log('   ❌ Error checking SSL certificate:', stderr);
        resolve(false);
        return;
      }
      
      console.log('   ✅ SSL certificate is valid');
      console.log('   - Certificate dates:');
      stdout.split('\n').forEach(line => {
        console.log('     ' + line);
      });
      
      resolve(true);
    });
  });
}

// Run all tests
async function runTests() {
  await checkRobotsTxt();
  await checkSitemapXml();
  await checkMetaTags();
  await checkGooglebot();
  await checkSSL();
  
  console.log('\n=== Summary ===\n');
  console.log('To ensure your site is properly crawled by search engines:');
  console.log('1. Verify your site in Google Search Console');
  console.log('2. Submit your sitemap.xml in Google Search Console');
  console.log('3. Use the URL Inspection tool to check if your pages can be indexed');
  console.log('4. Monitor your site\'s performance in Google Search Console');
  console.log('\nFor more detailed analysis, use tools like:');
  console.log('- Google PageSpeed Insights: https://pagespeed.web.dev/');
  console.log('- Lighthouse: Run in Chrome DevTools');
  console.log('- SEO analyzers like Ahrefs or SEMrush');
}

runTests();
