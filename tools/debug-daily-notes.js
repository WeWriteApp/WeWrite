// Debug script to test the daily notes API directly
const fetch = require('node-fetch');

async function testDailyNotesAPI() {
  try {
    // Using the actual user ID from the terminal logs
    const userId = 'fWNeCuussPgYgkN2LGohFRCPXiy1';
    
    console.log('Testing /api/my-pages endpoint...');
    
    const response = await fetch(`http://localhost:3000/api/my-pages?userId=${userId}&limit=2000&sortBy=title&sortDirection=asc`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('API Response Summary:');
    console.log('- Total pages found:', result.totalFound);
    console.log('- Pages returned:', result.pages.length);
    console.log('- Sort by:', result.sortBy);
    console.log('- Sort direction:', result.sortDirection);
    
    // Filter pages with custom dates
    const pagesWithCustomDate = result.pages.filter(page => page.customDate);
    console.log('\nPages with custom dates:', pagesWithCustomDate.length);
    
    pagesWithCustomDate.forEach(page => {
      console.log(`- ${page.id}: "${page.title}" (customDate: ${page.customDate})`);
    });
    
    // Check for yesterday specifically
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];
    
    console.log(`\nLooking for pages with customDate = ${yesterdayString}:`);
    const yesterdayPages = result.pages.filter(page => page.customDate === yesterdayString);
    
    if (yesterdayPages.length > 0) {
      console.log('Found pages for yesterday:');
      yesterdayPages.forEach(page => {
        console.log(`- ${page.id}: "${page.title}" (customDate: ${page.customDate})`);
      });
    } else {
      console.log('No pages found for yesterday');
    }
    
    // Check for the specific page mentioned
    const specificPage = result.pages.find(p => p.id === 'BYojetF6H58rq1xvf0mY');
    if (specificPage) {
      console.log('\nFound specific page BYojetF6H58rq1xvf0mY:');
      console.log('- Title:', specificPage.title);
      console.log('- Custom Date:', specificPage.customDate);
      console.log('- Has Custom Date:', !!specificPage.customDate);
    } else {
      console.log('\nSpecific page BYojetF6H58rq1xvf0mY NOT FOUND in API response');
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Run the test
testDailyNotesAPI();
