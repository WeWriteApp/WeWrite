/**
 * Comprehensive Test Suite for Unified Search System
 * 
 * This test suite ensures the unified search system works correctly
 * and provides complete record retrieval without artificial limits.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Next.js
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200
    }))
  }
}));

// Mock Firebase
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockStartAfter = jest.fn();
const mockCollection = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  getDocs: mockGetDocs
}));

jest.mock('../firebase/database', () => ({
  db: {}
}));

// Import the search function after mocking
import { GET } from '../api/search-unified/route.js';

describe('Unified Search System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn(); // Mock console.log
    console.error = jest.fn(); // Mock console.error
    console.warn = jest.fn(); // Mock console.warn
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Search API Endpoint', () => {
    it('should handle empty search terms for authenticated users', async () => {
      // Mock Firestore response for empty search
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'page1',
            data: () => ({
              title: 'Recent Page 1',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          }
        ]
      });

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=');
      const response = await GET(request);
      const data = await response.json();

      expect(data.pages).toBeDefined();
      expect(data.users).toBeDefined();
      expect(data.source).toBe('unified_empty_search');
    });

    it('should handle search terms and return comprehensive results', async () => {
      // Mock Firestore responses for search
      mockGetDocs
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              id: 'page1',
              data: () => ({
                title: 'Test Page 1',
                userId: 'user123',
                username: 'testuser',
                isPublic: true,
                lastModified: new Date(),
                deleted: false,
                content: 'This is test content'
              })
            },
            {
              id: 'page2',
              data: () => ({
                title: 'Another Test Page',
                userId: 'user123',
                username: 'testuser',
                isPublic: false,
                lastModified: new Date(),
                deleted: false,
                content: 'More test content'
              })
            }
          ]
        })
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              id: 'page3',
              data: () => ({
                title: 'Public Test Page',
                userId: 'user456',
                username: 'otheruser',
                isPublic: true,
                lastModified: new Date(),
                deleted: false,
                content: 'Public test content'
              })
            }
          ]
        })
        .mockResolvedValueOnce({
          empty: false,
          docs: [
            {
              id: 'user456',
              data: () => ({
                username: 'testuser456',
                email: 'test@example.com',
                usernameLower: 'testuser456'
              })
            }
          ]
        });

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=test&includeUsers=true');
      const response = await GET(request);
      const data = await response.json();

      expect(data.pages).toBeDefined();
      expect(data.pages.length).toBeGreaterThan(0);
      expect(data.users).toBeDefined();
      expect(data.source).toBe('unified_search');
      expect(data.performance).toBeDefined();
      expect(data.performance.searchTimeMs).toBeDefined();
    });

    it('should support different search contexts', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'page1',
            data: () => ({
              title: 'Link Editor Test',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          }
        ]
      });

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=test&context=link_editor&titleOnly=true');
      const response = await GET(request);
      const data = await response.json();

      expect(data.context).toBe('link_editor');
      expect(data.pages).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      mockGetDocs.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=test');
      const response = await GET(request);
      const data = await response.json();

      expect(data.error).toBeDefined();
      expect(data.source).toBe('unified_search_error');
      expect(data.pages).toEqual([]);
      expect(data.users).toEqual([]);
    });

    it('should respect maxResults parameter', async () => {
      // Mock large result set
      const largeMockDocs = Array.from({ length: 100 }, (_, i) => ({
        id: `page${i}`,
        data: () => ({
          title: `Test Page ${i}`,
          userId: 'user123',
          username: 'testuser',
          isPublic: true,
          lastModified: new Date(),
          deleted: false
        })
      }));

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: largeMockDocs
      });

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=test&maxResults=10');
      const response = await GET(request);
      const data = await response.json();

      expect(data.pages.length).toBeLessThanOrEqual(10);
    });

    it('should filter out deleted pages', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'page1',
            data: () => ({
              title: 'Active Page',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          },
          {
            id: 'page2',
            data: () => ({
              title: 'Deleted Page',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: true
            })
          }
        ]
      });

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=page');
      const response = await GET(request);
      const data = await response.json();

      // Should only return the active page
      expect(data.pages.length).toBe(1);
      expect(data.pages[0].title).toBe('Active Page');
    });

    it('should exclude current page from results', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'current-page',
            data: () => ({
              title: 'Current Page',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          },
          {
            id: 'other-page',
            data: () => ({
              title: 'Other Page',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          }
        ]
      });

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=page&currentPageId=current-page');
      const response = await GET(request);
      const data = await response.json();

      // Should exclude the current page
      expect(data.pages.length).toBe(1);
      expect(data.pages[0].id).toBe('other-page');
    });
  });

  describe('Search Scoring and Ranking', () => {
    it('should prioritize exact title matches', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'page1',
            data: () => ({
              title: 'test',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          },
          {
            id: 'page2',
            data: () => ({
              title: 'test page with more words',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          }
        ]
      });

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=test');
      const response = await GET(request);
      const data = await response.json();

      // Exact match should come first
      expect(data.pages[0].title).toBe('test');
    });

    it('should handle content matches with lower priority than title matches', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'page1',
            data: () => ({
              title: 'Different Title',
              content: 'This contains the test keyword',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          },
          {
            id: 'page2',
            data: () => ({
              title: 'test in title',
              content: 'No keyword here',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          }
        ]
      });

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=test&includeContent=true');
      const response = await GET(request);
      const data = await response.json();

      // Title match should come before content match
      expect(data.pages[0].title).toBe('test in title');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large result sets efficiently', async () => {
      // Simulate large dataset
      const largeMockDocs = Array.from({ length: 1000 }, (_, i) => ({
        id: `page${i}`,
        data: () => ({
          title: `Page ${i} with test keyword`,
          userId: 'user123',
          username: 'testuser',
          isPublic: true,
          lastModified: new Date(Date.now() - i * 1000),
          deleted: false
        })
      }));

      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: largeMockDocs
      });

      const startTime = Date.now();
      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=test&maxResults=100');
      const response = await GET(request);
      const data = await response.json();
      const endTime = Date.now();

      expect(data.pages.length).toBeLessThanOrEqual(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(data.performance.searchTimeMs).toBeDefined();
    });

    it('should provide performance metrics', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'page1',
            data: () => ({
              title: 'Test Page',
              userId: 'user123',
              username: 'testuser',
              isPublic: true,
              lastModified: new Date(),
              deleted: false
            })
          }
        ]
      });

      const request = new Request('http://localhost:3000/api/search-unified?userId=user123&searchTerm=test');
      const response = await GET(request);
      const data = await response.json();

      expect(data.performance).toBeDefined();
      expect(data.performance.searchTimeMs).toBeGreaterThan(0);
      expect(data.performance.pagesFound).toBeDefined();
      expect(data.performance.usersFound).toBeDefined();
    });
  });
});