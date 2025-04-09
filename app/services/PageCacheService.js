"use client";

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * PageCacheService
 *
 * A service that caches page content to improve performance when navigating between pages.
 * It prefetches linked pages and stores them in memory for faster access.
 */
class PageCacheService {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 30; // Increased maximum number of pages to keep in cache
    this.prefetchQueue = [];
    this.isPrefetching = false;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.prefetchPriority = new Map(); // Track priority of pages to prefetch
  }

  /**
   * Get a page from the cache or fetch it from Firestore
   * @param {string} pageId - The ID of the page to get
   * @returns {Promise<Object|null>} - The page data or null if not found
   */
  async getPage(pageId) {
    if (!pageId) return null;

    // Check if the page is in the cache
    if (this.cache.has(pageId)) {
      this.cacheHits++;
      console.log(`Page cache hit for ${pageId}. Total hits: ${this.cacheHits}`);
      return this.cache.get(pageId);
    }

    // If not in cache, fetch from Firestore
    this.cacheMisses++;
    console.log(`Page cache miss for ${pageId}. Total misses: ${this.cacheMisses}`);

    try {
      const pageDoc = await getDoc(doc(db, "pages", pageId));
      if (pageDoc.exists()) {
        const pageData = { id: pageDoc.id, ...pageDoc.data() };

        // Add to cache
        this.addToCache(pageId, pageData);

        return pageData;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching page ${pageId}:`, error);
      return null;
    }
  }

  /**
   * Add a page to the cache
   * @param {string} pageId - The ID of the page
   * @param {Object} pageData - The page data
   */
  addToCache(pageId, pageData) {
    // If cache is full, remove the oldest entry
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    // Add to cache with timestamp
    this.cache.set(pageId, {
      ...pageData,
      _cachedAt: Date.now()
    });

    console.log(`Added page ${pageId} to cache. Cache size: ${this.cache.size}`);
  }

  /**
   * Prefetch a page and add it to the cache
   * @param {string} pageId - The ID of the page to prefetch
   * @param {number} priority - Priority level (higher number = higher priority)
   */
  prefetchPage(pageId, priority = 1) {
    if (!pageId) return;

    // If already in cache, update last accessed time but don't prefetch again
    if (this.cache.has(pageId)) {
      const cachedPage = this.cache.get(pageId);
      cachedPage._cachedAt = Date.now();
      this.cache.set(pageId, cachedPage);
      return;
    }

    // Update priority if this page is already in the queue
    const currentPriority = this.prefetchPriority.get(pageId) || 0;
    this.prefetchPriority.set(pageId, Math.max(currentPriority, priority));

    // Add to prefetch queue if not already there
    if (!this.prefetchQueue.includes(pageId)) {
      this.prefetchQueue.push(pageId);

      // Sort queue by priority (higher priority first)
      this.prefetchQueue.sort((a, b) => {
        const priorityA = this.prefetchPriority.get(a) || 0;
        const priorityB = this.prefetchPriority.get(b) || 0;
        return priorityB - priorityA;
      });

      this.processPrefetchQueue();
    }
  }

  /**
   * Process the prefetch queue
   */
  async processPrefetchQueue() {
    if (this.isPrefetching || this.prefetchQueue.length === 0) return;

    this.isPrefetching = true;

    try {
      // Get the next page ID from the queue
      const pageId = this.prefetchQueue.shift();

      // Skip if already in cache
      if (this.cache.has(pageId)) {
        this.isPrefetching = false;
        this.processPrefetchQueue();
        return;
      }

      console.log(`Prefetching page ${pageId}`);

      // Fetch the page
      const pageDoc = await getDoc(doc(db, "pages", pageId));
      if (pageDoc.exists()) {
        const pageData = { id: pageDoc.id, ...pageDoc.data() };

        // Add to cache
        this.addToCache(pageId, pageData);
      }
    } catch (error) {
      console.error("Error prefetching page:", error);
    } finally {
      this.isPrefetching = false;

      // Process next item in queue
      if (this.prefetchQueue.length > 0) {
        setTimeout(() => this.processPrefetchQueue(), 100);
      }
    }
  }

  /**
   * Extract page IDs from content to prefetch with their positions
   * @param {Array} content - The page content
   * @returns {Array<Object>} - Array of objects with pageId and position
   */
  extractLinkedPageIds(content) {
    if (!content || !Array.isArray(content)) return [];

    const pageLinks = [];
    let position = 0;

    // Recursively search for links in the content
    const findLinks = (nodes) => {
      if (!nodes || !Array.isArray(nodes)) return;

      for (const node of nodes) {
        if (node.type === 'link' && node.pageId && !node.isUser) {
          // Add the page ID with its position in the document
          // Links at the top have higher priority (lower position number)
          pageLinks.push({
            pageId: node.pageId,
            position: position++
          });
        }

        // Recursively search children
        if (node.children) {
          findLinks(node.children);
        }
      }
    };

    findLinks(content);

    return pageLinks;
  }

  /**
   * Prefetch all linked pages in content
   * @param {Array} content - The page content
   */
  prefetchLinkedPages(content) {
    const pageLinks = this.extractLinkedPageIds(content);

    if (pageLinks.length > 0) {
      console.log(`Prefetching ${pageLinks.length} linked pages`);

      // Calculate priorities based on position
      // Links at the top of the page get higher priority
      const maxPosition = Math.max(...pageLinks.map(link => link.position), 1);

      // Add all page IDs to the prefetch queue with calculated priorities
      for (const link of pageLinks) {
        // Calculate priority: 10 for first link, gradually decreasing
        // This ensures links at the top of the page load first
        const priority = Math.max(10 - Math.floor((link.position / maxPosition) * 9), 1);
        this.prefetchPage(link.pageId, priority);
      }
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
    this.prefetchQueue = [];
    console.log("Page cache cleared");
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      queueLength: this.prefetchQueue.length,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.cacheHits + this.cacheMisses > 0
        ? (this.cacheHits / (this.cacheHits + this.cacheMisses) * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

// Create a singleton instance
const pageCacheService = new PageCacheService();

export default pageCacheService;
