/**
 * Test file for external links functionality
 * Tests the new aggregated external links with sorting and global counts
 */

import { getUserExternalLinksAggregated, getGlobalExternalLinkCount, getGlobalExternalLinkCounts } from '../firebase/database/links';

// Mock Firebase functions
jest.mock('../firebase/config', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn()
}));

jest.mock('../firebase/database/users', () => ({
  getUserPages: jest.fn()
}));

describe('External Links Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserExternalLinksAggregated', () => {
    it('should aggregate external links by URL', async () => {
      // Mock getUserPages to return test data
      const { getUserPages } = require('../firebase/database/users');
      getUserPages.mockResolvedValue({
        pages: [
          {
            id: 'page1',
            title: 'Test Page 1',
            content: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    url: 'https://example.com',
                    children: [{ text: 'Example Link' }]
                  }
                ]
              }
            ],
            lastModified: '2024-01-01T00:00:00Z'
          },
          {
            id: 'page2',
            title: 'Test Page 2',
            content: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    url: 'https://example.com',
                    children: [{ text: 'Another Example Link' }]
                  }
                ]
              }
            ],
            lastModified: '2024-01-02T00:00:00Z'
          }
        ]
      });

      // Mock global count function
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: [
          {
            id: 'page1',
            data: () => ({
              content: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'link',
                      url: 'https://example.com',
                      children: [{ text: 'Example Link' }]
                    }
                  ]
                }
              ]
            })
          }
        ]
      });

      const result = await getUserExternalLinksAggregated('testUserId', 'testUserId', 'recent');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        url: 'https://example.com',
        userCount: 2,
        pages: expect.arrayContaining([
          expect.objectContaining({ pageId: 'page1', pageTitle: 'Test Page 1' }),
          expect.objectContaining({ pageId: 'page2', pageTitle: 'Test Page 2' })
        ])
      });
    });

    it('should sort by most recent when sortBy is "recent"', async () => {
      const { getUserPages } = require('../firebase/database/users');
      getUserPages.mockResolvedValue({
        pages: [
          {
            id: 'page1',
            title: 'Older Page',
            content: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    url: 'https://old.com',
                    children: [{ text: 'Old Link' }]
                  }
                ]
              }
            ],
            lastModified: '2024-01-01T00:00:00Z'
          },
          {
            id: 'page2',
            title: 'Newer Page',
            content: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    url: 'https://new.com',
                    children: [{ text: 'New Link' }]
                  }
                ]
              }
            ],
            lastModified: '2024-01-02T00:00:00Z'
          }
        ]
      });

      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({ docs: [] });

      const result = await getUserExternalLinksAggregated('testUserId', 'testUserId', 'recent');

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://new.com'); // Most recent first
      expect(result[1].url).toBe('https://old.com');
    });

    it('should sort by oldest when sortBy is "oldest"', async () => {
      const { getUserPages } = require('../firebase/database/users');
      getUserPages.mockResolvedValue({
        pages: [
          {
            id: 'page1',
            title: 'Older Page',
            content: JSON.stringify([
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    linkType: 'external',
                    url: 'https://old.com',
                    children: [{ text: 'Old Link' }]
                  }
                ]
              }
            ]),
            lastModified: '2024-01-01T00:00:00Z'
          },
          {
            id: 'page2',
            title: 'Newer Page',
            content: JSON.stringify([
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'link',
                    linkType: 'external',
                    url: 'https://new.com',
                    children: [{ text: 'New Link' }]
                  }
                ]
              }
            ]),
            lastModified: '2024-01-02T00:00:00Z'
          }
        ]
      });

      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({ docs: [] });

      const result = await getUserExternalLinksAggregated('testUserId', 'testUserId', 'oldest');

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://old.com'); // Oldest first
      expect(result[1].url).toBe('https://new.com');
    });
  });

  describe('getGlobalExternalLinkCount', () => {
    it('should count occurrences of external URL across all public pages', async () => {
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: [
          {
            id: 'page1',
            data: () => ({
              content: JSON.stringify([
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'link',
                      linkType: 'external',
                      url: 'https://example.com',
                      children: [{ text: 'Example Link' }]
                    }
                  ]
                }
              ])
            })
          },
          {
            id: 'page2',
            data: () => ({
              content: JSON.stringify([
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'link',
                      linkType: 'external',
                      url: 'https://example.com',
                      children: [{ text: 'Another Example Link' }]
                    }
                  ]
                }
              ])
            })
          }
        ]
      });

      const count = await getGlobalExternalLinkCount('https://example.com');
      expect(count).toBe(2);
    });
  });

  describe('getGlobalExternalLinkCounts', () => {
    it('should efficiently count multiple URLs', async () => {
      const { getDocs } = require('firebase/firestore');
      getDocs.mockResolvedValue({
        docs: [
          {
            id: 'page1',
            data: () => ({
              content: JSON.stringify([
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'link',
                      linkType: 'external',
                      url: 'https://example.com',
                      children: [{ text: 'Example Link' }]
                    },
                    {
                      type: 'link',
                      linkType: 'external',
                      url: 'https://test.com',
                      children: [{ text: 'Test Link' }]
                    }
                  ]
                }
              ])
            })
          }
        ]
      });

      const counts = await getGlobalExternalLinkCounts(['https://example.com', 'https://test.com', 'https://notfound.com']);
      
      expect(counts.get('https://example.com')).toBe(1);
      expect(counts.get('https://test.com')).toBe(1);
      expect(counts.get('https://notfound.com')).toBe(0);
    });
  });
});
