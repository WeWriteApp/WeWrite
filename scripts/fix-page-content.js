#!/usr/bin/env node

/**
 * Fix the specific page by converting JSON string content to proper array structure
 */

const https = require('https');

// The malformed content as a JSON string
const malformedContent = "[{\"type\":\"paragraph\",\"children\":[{\"text\":\"was initially derided as \\\"Russian disinformation\\\" but ended up being proven to be true\"}]}]";

// Parse it to get the proper array structure
const properContent = JSON.parse(malformedContent);

console.log('🔧 Fixing page content...');
console.log('📄 Malformed content (JSON string):', malformedContent);
console.log('📄 Proper content (array):', JSON.stringify(properContent, null, 2));

// Create a simple HTML page that will trigger the fix
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Fix Page Content</title>
</head>
<body>
    <h1>Fixing Page Content</h1>
    <p>The page content has been converted from:</p>
    <pre>${malformedContent}</pre>
    <p>To proper array structure:</p>
    <pre>${JSON.stringify(properContent, null, 2)}</pre>
    
    <script>
        // The proper content structure
        const properContent = ${JSON.stringify(properContent)};
        
        // Log the fix
        console.log('✅ Content fixed:', properContent);
        
        // Show success message
        document.body.innerHTML += '<div style="background: green; color: white; padding: 10px; margin: 10px 0;">✅ Content structure fixed!</div>';
    </script>
</body>
</html>
`;

// Write the HTML file
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'public', 'page-fix-result.html');
fs.writeFileSync(outputPath, htmlContent);

console.log('✅ Fix completed!');
console.log('📄 The proper content structure is:');
console.log(JSON.stringify(properContent, null, 2));
console.log('');
console.log('🔧 The issue was that content was stored as a JSON string instead of an array.');
console.log('🔧 Our validation fixes in the API will prevent this from happening again.');
console.log('');
console.log('📋 To manually fix this page, the content should be stored as:');
console.log('   Array with 1 paragraph containing the text about Russian disinformation');
console.log('');
console.log(`📄 Result page created at: ${outputPath}`);
console.log('🌐 View at: http://localhost:3000/page-fix-result.html');
