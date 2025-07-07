/**
 * Test script for the trending pages API
 * Run with: node scripts/test-trending-api.js
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testTrendingAPI() {
  console.log('🧪 Testing Trending Pages API\n');

  try {
    console.log('📊 Testing /api/trending endpoint...');
    
    const response = await fetch(`${BASE_URL}/api/trending?limit=5`);
    console.log(`Status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`❌ API request failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const result = await response.json();
    console.log('Response structure:', {
      success: result.success,
      hasData: !!result.data,
      hasTrendingPages: !!result.data?.trendingPages,
      pagesCount: result.data?.trendingPages?.length || 0
    });

    if (result.success) {
      const pages = result.data.trendingPages || [];
      console.log(`✅ Successfully fetched ${pages.length} trending pages`);
      
      if (pages.length > 0) {
        console.log('\n📄 Sample page data:');
        const samplePage = pages[0];
        console.log({
          id: samplePage.id,
          title: samplePage.title,
          views: samplePage.views,
          views24h: samplePage.views24h,
          username: samplePage.username,
          hasHourlyViews: Array.isArray(samplePage.hourlyViews),
          hourlyViewsLength: samplePage.hourlyViews?.length
        });
      } else {
        console.log('ℹ️  No trending pages found (this is normal if database is empty)');
      }
    } else {
      console.error('❌ API returned error:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testTrendingAPI().catch(console.error);
}

module.exports = { testTrendingAPI };
