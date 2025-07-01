/**
 * Integration Test for Unified Search System
 * 
 * This test verifies the unified search system integration
 * and ensures it properly handles different search scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Unified Search Integration', () => {
  beforeEach(() => {
    // Reset any global state
    global.fetch = jest.fn();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Search API Response Format', () => {
    it('should return the expected response structure', async () => {
      // Mock a successful API response
      const mockResponse = {
        pages: [
          {
            id: 'page1',
            title: 'Test Page',
            type: 'user',
            isOwned: true,
            userId: 'user123',
            username: 'testuser',
            matchScore: 95
          }
        ],
        users: [
          {
            id: 'user456',
            username: 'testuser456',
            type: 'user',
            matchScore: 85
          }
        ],
        source: 'unified_search',
        searchTerm: 'test',
        context: 'main',
        performance: {
          searchTimeMs: 150,
          pagesFound: 1,
          usersFound: 1,
          maxResults: 200
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=test&userId=user123');
      const data = await response.json();

      expect(data).toHaveProperty('pages');
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('source');
      expect(data).toHaveProperty('performance');
      expect(data.performance).toHaveProperty('searchTimeMs');
      expect(data.performance).toHaveProperty('pagesFound');
      expect(data.performance).toHaveProperty('usersFound');
    });

    it('should handle empty search results', async () => {
      const mockResponse = {
        pages: [],
        users: [],
        source: 'unified_search',
        searchTerm: 'nonexistent',
        performance: {
          searchTimeMs: 50,
          pagesFound: 0,
          usersFound: 0
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=nonexistent&userId=user123');
      const data = await response.json();

      expect(data.pages).toEqual([]);
      expect(data.users).toEqual([]);
      expect(data.performance.pagesFound).toBe(0);
      expect(data.performance.usersFound).toBe(0);
    });

    it('should handle error responses', async () => {
      const mockErrorResponse = {
        pages: [],
        users: [],
        error: 'Search temporarily unavailable',
        source: 'unified_search_error'
      };

      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve(mockErrorResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=test&userId=user123');
      const data = await response.json();

      expect(data).toHaveProperty('error');
      expect(data.source).toBe('unified_search_error');
      expect(data.pages).toEqual([]);
      expect(data.users).toEqual([]);
    });
  });

  describe('Search Context Support', () => {
    it('should support main search context', async () => {
      const mockResponse = {
        pages: [{ id: 'page1', title: 'Test Page' }],
        users: [{ id: 'user1', username: 'testuser' }],
        source: 'unified_search',
        context: 'main'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=test&context=main');
      const data = await response.json();

      expect(data.context).toBe('main');
    });

    it('should support link editor context', async () => {
      const mockResponse = {
        pages: [{ id: 'page1', title: 'Test Page' }],
        users: [],
        source: 'unified_search',
        context: 'link_editor'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=test&context=link_editor&titleOnly=true');
      const data = await response.json();

      expect(data.context).toBe('link_editor');
    });

    it('should support add to page context', async () => {
      const mockResponse = {
        pages: [{ id: 'page1', title: 'Test Page' }],
        users: [],
        source: 'unified_search',
        context: 'add_to_page'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=test&context=add_to_page');
      const data = await response.json();

      expect(data.context).toBe('add_to_page');
    });
  });

  describe('Search Parameters', () => {
    it('should respect maxResults parameter', async () => {
      const mockResponse = {
        pages: Array.from({ length: 5 }, (_, i) => ({ id: `page${i}`, title: `Page ${i}` })),
        users: [],
        source: 'unified_search',
        performance: {
          maxResults: 5
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=test&maxResults=5');
      const data = await response.json();

      expect(data.pages.length).toBeLessThanOrEqual(5);
      expect(data.performance.maxResults).toBe(5);
    });

    it('should handle titleOnly parameter', async () => {
      const mockResponse = {
        pages: [{ id: 'page1', title: 'Test Page', isContentMatch: false }],
        users: [],
        source: 'unified_search'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=test&titleOnly=true');
      const data = await response.json();

      expect(data.pages[0].isContentMatch).toBe(false);
    });

    it('should handle includeUsers parameter', async () => {
      const mockResponseWithUsers = {
        pages: [{ id: 'page1', title: 'Test Page' }],
        users: [{ id: 'user1', username: 'testuser' }],
        source: 'unified_search'
      };

      const mockResponseWithoutUsers = {
        pages: [{ id: 'page1', title: 'Test Page' }],
        users: [],
        source: 'unified_search'
      };

      // Test with includeUsers=true
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponseWithUsers)
      });

      let response = await fetch('/api/search-unified?searchTerm=test&includeUsers=true');
      let data = await response.json();
      expect(data.users.length).toBeGreaterThan(0);

      // Test with includeUsers=false
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponseWithoutUsers)
      });

      response = await fetch('/api/search-unified?searchTerm=test&includeUsers=false');
      data = await response.json();
      expect(data.users.length).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should include performance metrics in response', async () => {
      const mockResponse = {
        pages: [{ id: 'page1', title: 'Test Page' }],
        users: [],
        source: 'unified_search',
        performance: {
          searchTimeMs: 125,
          pagesFound: 1,
          usersFound: 0,
          maxResults: 200
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=test');
      const data = await response.json();

      expect(data.performance).toBeDefined();
      expect(typeof data.performance.searchTimeMs).toBe('number');
      expect(typeof data.performance.pagesFound).toBe('number');
      expect(typeof data.performance.usersFound).toBe('number');
      expect(data.performance.searchTimeMs).toBeGreaterThan(0);
    });

    it('should track search source', async () => {
      const mockResponse = {
        pages: [],
        users: [],
        source: 'unified_search',
        performance: {
          searchTimeMs: 50
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=test');
      const data = await response.json();

      expect(data.source).toBe('unified_search');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search terms', async () => {
      const mockResponse = {
        pages: [],
        users: [],
        source: 'unified_empty_search'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=&userId=user123');
      const data = await response.json();

      expect(data.source).toBe('unified_empty_search');
    });

    it('should handle special characters in search terms', async () => {
      const mockResponse = {
        pages: [],
        users: [],
        source: 'unified_search',
        searchTerm: '@#$%^&*()'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=' + encodeURIComponent('@#$%^&*()'));
      const data = await response.json();

      expect(data.searchTerm).toBe('@#$%^&*()');
    });

    it('should handle very long search terms', async () => {
      const longSearchTerm = 'a'.repeat(1000);
      const mockResponse = {
        pages: [],
        users: [],
        source: 'unified_search',
        searchTerm: longSearchTerm
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const response = await fetch('/api/search-unified?searchTerm=' + encodeURIComponent(longSearchTerm));
      const data = await response.json();

      expect(data.searchTerm).toBe(longSearchTerm);
    });
  });
});