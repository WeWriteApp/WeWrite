const puppeteer = require('puppeteer');

async function readDebugData() {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Navigate to the app
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Read debug data from localStorage
    const debugData = await page.evaluate(() => {
      const debug = localStorage.getItem('wewrite-debug');
      const lineMode = localStorage.getItem('lineMode');
      return {
        debugEntries: debug ? JSON.parse(debug) : [],
        currentLineMode: lineMode
      };
    });
    
    console.log('=== WeWrite Debug Data ===');
    console.log('Current lineMode in localStorage:', debugData.currentLineMode);
    console.log('');
    
    if (debugData.debugEntries.length > 0) {
      console.log('Debug entries:');
      debugData.debugEntries.forEach((entry, index) => {
        console.log(`${index + 1}. [${entry.timestamp}] ${entry.component} - ${entry.action || 'render'}`);
        console.log('   Data:', JSON.stringify(entry, null, 2));
        console.log('');
      });
    } else {
      console.log('No debug entries found');
    }
    
  } catch (error) {
    console.error('Error reading debug data:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

readDebugData();
