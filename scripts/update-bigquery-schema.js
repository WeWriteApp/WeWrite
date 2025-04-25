/**
 * Script to update BigQuery schema to add isPublic field
 * 
 * Usage:
 * node scripts/update-bigquery-schema.js
 */

const { BigQuery } = require('@google-cloud/bigquery');

async function updateBigQuerySchema() {
  try {
    console.log('Initializing BigQuery client...');
    
    // Initialize BigQuery client
    const bigquery = new BigQuery();
    
    // Define the dataset and table
    const datasetId = 'pages_indexes';
    const tableId = 'pages';
    
    console.log(`Getting current schema for ${datasetId}.${tableId}...`);
    
    // Get the current table metadata
    const [metadata] = await bigquery
      .dataset(datasetId)
      .table(tableId)
      .getMetadata();
    
    // Get the current schema
    const currentSchema = metadata.schema.fields;
    console.log('Current schema:', currentSchema.map(field => field.name));
    
    // Check if isPublic field already exists
    if (currentSchema.some(field => field.name === 'isPublic')) {
      console.log('isPublic field already exists in schema. No update needed.');
      return;
    }
    
    // Add the isPublic field to the schema
    const newSchema = [...currentSchema, {
      name: 'isPublic',
      type: 'BOOLEAN',
      mode: 'NULLABLE',
      description: 'Whether the page is publicly accessible'
    }];
    
    console.log('Updating schema to add isPublic field...');
    
    // Update the table schema
    await bigquery
      .dataset(datasetId)
      .table(tableId)
      .setMetadata({
        schema: {
          fields: newSchema
        }
      });
    
    console.log('Schema updated successfully!');
    console.log('New schema:', newSchema.map(field => field.name));
    
    // Now we need to update existing rows to set isPublic values
    console.log('Note: Existing rows will have NULL values for isPublic.');
    console.log('You will need to run a separate script to update existing rows with correct isPublic values.');
    
  } catch (error) {
    console.error('Error updating BigQuery schema:', error);
  }
}

// Run the function
updateBigQuerySchema();
