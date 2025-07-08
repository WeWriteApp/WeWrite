#!/usr/bin/env node

/**
 * Test script to create a page and verify activity creation
 */

const fetch = require('node-fetch');

async function testPageCreation() {
  try {
    console.log('🧪 Testing page creation and activity generation...');
    
    // Check activities before
    console.log('\n📊 Checking activities before page creation...');
    const beforeResponse = await fetch('http://localhost:3000/api/activity?limit=5');
    const beforeData = await beforeResponse.json();
    console.log(`Activities before: ${beforeData.activities.length}`);
    
    // Create a test page
    console.log('\n📝 Creating test page...');
    const pageData = {
      title: 'Test Activity Page ' + Date.now(),
      content: JSON.stringify([
        {
          type: "paragraph",
          children: [{ text: "This is a test page to verify activity creation is working." }]
        }
      ]),
      isPublic: true
    };
    
    const createResponse = await fetch('http://localhost:3000/api/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This won't work without proper authentication
        // But we can see if the endpoint responds
      },
      body: JSON.stringify(pageData)
    });
    
    console.log(`Create response status: ${createResponse.status}`);
    const createData = await createResponse.json();
    console.log('Create response:', createData);
    
    if (createResponse.status === 201) {
      console.log(`✅ Page created with ID: ${createData.id}`);
      
      // Wait a moment for activity to be created
      console.log('\n⏳ Waiting 2 seconds for activity creation...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check activities after
      console.log('\n📊 Checking activities after page creation...');
      const afterResponse = await fetch('http://localhost:3000/api/activity?limit=5');
      const afterData = await afterResponse.json();
      console.log(`Activities after: ${afterData.activities.length}`);
      
      if (afterData.activities.length > beforeData.activities.length) {
        console.log('✅ SUCCESS! Activity was created for the new page.');
        console.log('Latest activity:', afterData.activities[0]);
      } else {
        console.log('❌ FAILED! No new activity was created.');
      }
    } else {
      console.log('❌ Page creation failed:', createData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPageCreation().then(() => {
  console.log('\n🏁 Test completed');
}).catch(error => {
  console.error('💥 Test failed:', error);
});
