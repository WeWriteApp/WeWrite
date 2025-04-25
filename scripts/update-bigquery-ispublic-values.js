/**
 * Script to update existing rows in BigQuery with isPublic values from Firestore
 * 
 * Usage:
 * node scripts/update-bigquery-ispublic-values.js
 */

const { BigQuery } = require('@google-cloud/bigquery');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const firebaseConfig = require('../firebase/config');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateIsPublicValues() {
  try {
    console.log('Initializing BigQuery client...');
    
    // Initialize BigQuery client
    const bigquery = new BigQuery();
    
    // Define the dataset and table
    const datasetId = 'pages_indexes';
    const tableId = 'pages';
    
    console.log('Fetching public pages from Firestore...');
    
    // Query Firestore for all public pages
    const publicPagesQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true)
    );
    
    const publicPagesSnapshot = await getDocs(publicPagesQuery);
    const publicPageIds = [];
    
    publicPagesSnapshot.forEach(doc => {
      publicPageIds.push(doc.id);
    });
    
    console.log(`Found ${publicPageIds.length} public pages in Firestore`);
    
    if (publicPageIds.length === 0) {
      console.log('No public pages found. Nothing to update.');
      return;
    }
    
    // Process in batches to avoid query size limits
    const batchSize = 1000;
    for (let i = 0; i < publicPageIds.length; i += batchSize) {
      const batchIds = publicPageIds.slice(i, i + batchSize);
      const idsList = batchIds.map(id => `'${id}'`).join(', ');
      
      console.log(`Updating batch ${Math.floor(i/batchSize) + 1} (${batchIds.length} pages)...`);
      
      // Create and execute update query
      const updateQuery = `
        UPDATE \`${datasetId}.${tableId}\`
        SET isPublic = TRUE
        WHERE document_id IN (${idsList})
      `;
      
      await bigquery.query({
        query: updateQuery
      });
    }
    
    // Set all other pages to not public
    console.log('Setting remaining pages to not public...');
    
    const defaultQuery = `
      UPDATE \`${datasetId}.${tableId}\`
      SET isPublic = FALSE
      WHERE isPublic IS NULL
    `;
    
    await bigquery.query({
      query: defaultQuery
    });
    
    console.log('Successfully updated isPublic values for all pages!');
    
  } catch (error) {
    console.error('Error updating isPublic values:', error);
  }
}

// Run the function
updateIsPublicValues();
