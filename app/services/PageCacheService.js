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
    this.maxCacheSize = 20; // Maximum number of pages to keep in cache
    this.prefetchQueue = [];
    this.isPrefetching = false;
    this.cacheHits = 0;
    this.cacheMisses = 0;
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
   */
  prefetchPage(pageId) {
    if (!pageId || this.cache.has(pageId)) return;
    
    // Add to prefetch queue
    if (!this.prefetchQueue.includes(pageId)) {
      this.prefetchQueue.push(pageId);
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
   * Extract page IDs from content to prefetch
   * @param {Array} content - The page content
   * @returns {Array<string>} - Array of page IDs to prefetch
   */
  extractLinkedPageIds(content) {
    if (!content || !Array.isArray(content)) return [];
    
    const pageIds = new Set();
    
    // Recursively search for links in the content
    const findLinks = (nodes) => {
      if (!nodes || !Array.isArray(nodes)) return;
      
      for (const node of nodes) {
        if (node.type === 'link' && node.pageId && !node.isUser) {
          pageIds.add(node.pageId);
        }
        
        // Recursively search children
        if (node.children) {
          findLinks(node.children);
        }
      }
    };
    
    findLinks(content);
    
    return Array.from(pageIds);
  }

  /**
   * Prefetch all linked pages in content
   * @param {Array} content - The page content
   */
  prefetchLinkedPages(content) {
    const pageIds = this.extractLinkedPageIds(content);
    
    if (pageIds.length > 0) {
      console.log(`Prefetching ${pageIds.length} linked pages`);
      
      // Add all page IDs to the prefetch queue
      for (const pageId of pageIds) {
        this.prefetchPage(pageId);
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
