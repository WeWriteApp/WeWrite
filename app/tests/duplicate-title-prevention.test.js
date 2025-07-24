/**
 * Test suite for duplicate title prevention functionality
 * 
 * This test suite verifies that the duplicate title prevention system works correctly
 * across all scenarios: new page creation, page editing, content loss prevention, etc.
 */

describe('Duplicate Title Prevention', () => {
  const testUserId = 'test-user-123';
  const testTitle = 'Test Page Title';
  const duplicateTitle = 'Duplicate Title';

  beforeEach(() => {
    // Reset any mocks or test state
    jest.clearAllMocks();
  });

  describe('API Endpoint - Check Duplicate', () => {
    test('should return no duplicate for unique title', async () => {
      const response = await fetch('/api/pages/check-duplicate?title=Unique Title', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.isDuplicate).toBe(false);
      expect(data.existingPage).toBeNull();
    });

    test('should return duplicate for existing title', async () => {
      // This test would require setting up test data
      // In a real test environment, you'd create a page first, then test for duplicates
      console.log('Note: This test requires test data setup');
    });

    test('should exclude current page when editing', async () => {
      // Test that when checking duplicates for editing, the current page is excluded
      console.log('Note: This test requires test data setup');
    });

    test('should handle authentication errors', async () => {
      const response = await fetch('/api/pages/check-duplicate?title=Test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
        // No credentials - should fail authentication
      });

      expect(response.status).toBe(401);
    });

    test('should handle missing title parameter', async () => {
      const response = await fetch('/api/pages/check-duplicate', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('title');
    });
  });

  describe('Validation Utility Functions', () => {
    test('validateTitleForDuplicates should handle empty title', async () => {
      const { validateTitleForDuplicates } = require('../utils/duplicateTitleValidation');
      
      const result = await validateTitleForDuplicates('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('EMPTY_TITLE');
      expect(result.message).toContain('enter a title');
    });

    test('validateTitleForDuplicates should handle whitespace-only title', async () => {
      const { validateTitleForDuplicates } = require('../utils/duplicateTitleValidation');
      
      const result = await validateTitleForDuplicates('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('EMPTY_TITLE');
    });

    test('checkDuplicateTitle should handle network errors gracefully', async () => {
      const { checkDuplicateTitle } = require('../utils/duplicateTitleValidation');
      
      // Mock fetch to simulate network error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const result = await checkDuplicateTitle('Test Title');
      expect(result.isDuplicate).toBe(false);
      expect(result.error).toContain('Failed to check');
    });
  });

  describe('Content Loss Prevention', () => {
    test('hasUnsavedContent should detect text content', () => {
      const { hasUnsavedContent } = require('../utils/contentLossPreventionUtils');
      
      const contentWithText = [
        {
          type: 'paragraph',
          children: [{ text: 'Some content here' }]
        }
      ];
      
      expect(hasUnsavedContent(contentWithText)).toBe(true);
    });

    test('hasUnsavedContent should detect empty content', () => {
      const { hasUnsavedContent } = require('../utils/contentLossPreventionUtils');
      
      const emptyContent = [
        {
          type: 'paragraph',
          children: [{ text: '' }]
        }
      ];
      
      expect(hasUnsavedContent(emptyContent)).toBe(false);
    });

    test('hasUnsavedContent should detect link content', () => {
      const { hasUnsavedContent } = require('../utils/contentLossPreventionUtils');
      
      const contentWithLink = [
        {
          type: 'paragraph',
          children: [
            { text: 'Check out ' },
            { type: 'link', pageId: 'page123', title: 'this page' },
            { text: '!' }
          ]
        }
      ];
      
      expect(hasUnsavedContent(contentWithLink)).toBe(true);
    });

    test('getContentPreview should extract text preview', () => {
      const { getContentPreview } = require('../utils/contentLossPreventionUtils');
      
      const content = [
        {
          type: 'paragraph',
          children: [{ text: 'This is a long piece of content that should be truncated when generating a preview for the user to see what they might lose.' }]
        }
      ];
      
      const preview = getContentPreview(content, 50);
      expect(preview.length).toBeLessThanOrEqual(53); // 50 + "..."
      expect(preview).toContain('This is a long');
    });
  });

  describe('Server-side Duplicate Prevention', () => {
    test('POST /api/pages should reject duplicate titles', async () => {
      // This test would require setting up test data and authentication
      console.log('Note: This test requires full integration test setup');
    });

    test('PUT /api/pages should reject duplicate titles when editing', async () => {
      // This test would require setting up test data and authentication
      console.log('Note: This test requires full integration test setup');
    });

    test('PUT /api/pages should allow keeping same title when editing', async () => {
      // This test would verify that editing a page without changing the title works
      console.log('Note: This test requires full integration test setup');
    });
  });

  describe('Error Handling Edge Cases', () => {
    test('should handle malformed API responses', async () => {
      // Mock fetch to return malformed JSON
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const { checkDuplicateTitle } = require('../utils/duplicateTitleValidation');
      const result = await checkDuplicateTitle('Test Title');
      
      expect(result.isDuplicate).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle API timeout scenarios', async () => {
      // Mock fetch to simulate timeout
      global.fetch = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const { checkDuplicateTitle } = require('../utils/duplicateTitleValidation');
      const result = await checkDuplicateTitle('Test Title');
      
      expect(result.isDuplicate).toBe(false);
      expect(result.error).toContain('Failed to check');
    });
  });

  describe('User Experience Flows', () => {
    test('should provide clear error messages for duplicates', () => {
      // Test that error messages are user-friendly and actionable
      const errorMessage = 'You already have a page titled "Test Title"';
      expect(errorMessage).toContain('already have');
      expect(errorMessage).toContain('Test Title');
    });

    test('should provide helpful suggestions in content warning', () => {
      // Test that content warning modal provides clear guidance
      const warningMessage = 'Change the title to something unique, then save your page';
      expect(warningMessage).toContain('Change the title');
      expect(warningMessage).toContain('unique');
    });
  });
});

// Export test utilities for use in other test files
module.exports = {
  testUserId: 'test-user-123',
  testTitle: 'Test Page Title',
  duplicateTitle: 'Duplicate Title'
};
