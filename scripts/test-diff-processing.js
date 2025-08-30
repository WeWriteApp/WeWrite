#!/usr/bin/env node

/**
 * Test script for diff processing functionality
 * Tests the new diff content processor to ensure it works correctly
 */

const { processDiffForDisplay } = require('../app/utils/diffContentProcessor');

// Test data
const previousContent = [
  {
    type: "paragraph",
    children: [
      { text: "Hello world" }
    ]
  },
  {
    type: "paragraph", 
    children: [
      { text: "This is a test paragraph." }
    ]
  }
];

const currentContent = [
  {
    type: "paragraph",
    children: [
      { text: "Hello beautiful world" }
    ]
  },
  {
    type: "paragraph",
    children: [
      { text: "This is a test paragraph with more content." }
    ]
  },
  {
    type: "paragraph",
    children: [
      { text: "This is a new paragraph added." }
    ]
  }
];

// Mock diff result
const mockDiffResult = {
  added: 25,
  removed: 0,
  operations: [
    { type: 'equal', text: 'Hello ', start: 0 },
    { type: 'add', text: 'beautiful ', start: 6 },
    { type: 'equal', text: 'world\nThis is a test paragraph', start: 15 },
    { type: 'add', text: ' with more content', start: 41 },
    { type: 'equal', text: '.\n', start: 59 },
    { type: 'add', text: 'This is a new paragraph added.', start: 61 }
  ],
  preview: {
    beforeContext: 'Hello ',
    addedText: 'beautiful world\nThis is a test paragraph with more content.\nThis is a new paragraph added.',
    removedText: '',
    afterContext: '',
    hasAdditions: true,
    hasRemovals: false
  },
  hasChanges: true
};

console.log('🧪 Testing diff processing...');
console.log('');

try {
  const result = processDiffForDisplay(currentContent, previousContent, mockDiffResult);
  
  console.log('✅ Diff processing successful!');
  console.log('');
  console.log('📊 Summary:', result.summary);
  console.log('');
  console.log('📝 Processed content:');
  
  result.content.forEach((paragraph, index) => {
    console.log(`  Paragraph ${index + 1} (${paragraph.diffType}):`);
    paragraph.children.forEach((child, childIndex) => {
      const annotations = [];
      if (child.added) annotations.push('ADDED');
      if (child.removed) annotations.push('REMOVED');
      if (child.bold) annotations.push('BOLD');
      if (child.italic) annotations.push('ITALIC');
      
      const annotationStr = annotations.length > 0 ? ` [${annotations.join(', ')}]` : '';
      console.log(`    ${childIndex + 1}. "${child.text}"${annotationStr}`);
    });
    console.log('');
  });
  
  console.log('🎉 Test completed successfully!');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
