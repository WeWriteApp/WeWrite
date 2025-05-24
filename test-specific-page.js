#!/usr/bin/env node

/**
 * Test script to check if the specific page gTvBVOC3UNSvGodSPzs5 exists
 */

// Import Firebase modules
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Firebase config (same as in the app)
const firebaseConfig = {
  apiKey: "AIzaSyBJGZKJJJJJJJJJJJJJJJJJJJJJJJJJJJJ", // This will be replaced by actual config
  authDomain: "wewrite-ccd82.firebaseapp.com",
  databaseURL: "https://wewrite-ccd82-default-rtdb.firebaseio.com",
  projectId: "wewrite-ccd82",
  storageBucket: "wewrite-ccd82.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdefghijklmnop"
};

async function checkSpecificPage() {
  console.log('🔍 Checking if page gTvBVOC3UNSvGodSPzs5 exists');
  console.log('===============================================\n');

  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Get the specific page
    const pageId = 'gTvBVOC3UNSvGodSPzs5';
    const pageRef = doc(db, 'pages', pageId);
    const pageDoc = await getDoc(pageRef);

    if (pageDoc.exists()) {
      const pageData = pageDoc.data();
      console.log('🎯 PAGE FOUND!');
      console.log('================');
      console.log('ID:', pageDoc.id);
      console.log('Title:', pageData.title || 'Untitled');
      console.log('User ID:', pageData.userId);
      console.log('Username:', pageData.username || 'Not set');
      console.log('Is Public:', pageData.isPublic);
      console.log('Last Modified:', pageData.lastModified);
      console.log('Created At:', pageData.createdAt);
      console.log('');
      console.log('Full page data:');
      console.log(JSON.stringify(pageData, null, 2));
      
      // Now test if this page would be found by search
      console.log('\n🔍 Testing search for this page:');
      console.log('================================');
      
      const title = pageData.title || '';
      const normalizedTitle = title.toLowerCase();
      
      console.log(`Page title: "${title}"`);
      console.log(`Normalized title: "${normalizedTitle}"`);
      console.log(`Search term: "my book lists"`);
      console.log(`Search term normalized: "my book lists"`);
      
      // Test exact match
      const exactMatch = normalizedTitle.includes('my book lists');
      console.log(`Exact substring match: ${exactMatch}`);
      
      // Test word-by-word match
      const searchWords = ['my', 'book', 'lists'];
      const titleWords = normalizedTitle.split(/\s+/);
      console.log(`Title words: [${titleWords.join(', ')}]`);
      console.log(`Search words: [${searchWords.join(', ')}]`);
      
      const wordMatches = searchWords.map(searchWord => {
        const match = titleWords.some(titleWord => {
          return titleWord === searchWord || 
                 titleWord.includes(searchWord) || 
                 searchWord.includes(titleWord);
        });
        console.log(`  "${searchWord}" matches: ${match}`);
        return match;
      });
      
      const allWordsMatch = wordMatches.every(match => match);
      console.log(`All words match: ${allWordsMatch}`);
      
    } else {
      console.log('❌ PAGE NOT FOUND');
      console.log('The page gTvBVOC3UNSvGodSPzs5 does not exist in the database.');
    }

  } catch (error) {
    console.error('❌ Error checking page:', error);
  }
}

// Run the test
checkSpecificPage();
