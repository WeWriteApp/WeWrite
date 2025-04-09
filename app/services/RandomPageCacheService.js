"use client";

import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * RandomPageCacheService
 * 
 * A service that caches random pages to improve performance of the random page button.
 * It prefetches a set of random pages and stores them in memory, then provides them
 * one at a time when requested.
 */
class RandomPageCacheService {
  constructor() {
    this.cachedPages = [];
    this.isInitialized = false;
    this.isLoading = false;
    this.cacheSize = 5; // Number of pages to keep in cache
    this.usedPageIds = new Set(); // Track recently used page IDs to avoid repeats
    this.maxUsedPageIds = 20; // Maximum number of page IDs to remember
  }

  /**
   * Initialize the cache service
   */
  async initialize() {
    if (this.isInitialized || this.isLoading) return;
    
    this.isLoading = true;
    try {
      await this.refillCache();
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing random page cache:', error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Refill the cache with random pages
   */
  async refillCache() {
    try {
      console.log('Refilling random page cache');
      
      // Query for public pages
      const pagesRef = collection(db, 'pages');
      const publicPagesQuery = query(
        pagesRef,
        where('isPublic', '==', true),
        limit(100) // Limit to 100 pages for performance
      );
      
      const snapshot = await getDocs(publicPagesQuery);
      
      if (snapshot.empty) {
        console.error('No pages found in the database');
        return;
      }
      
      // Convert to array and filter out any potentially deleted pages
      // and pages we've recently used
      const pages = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        // Skip any pages that might be marked as deleted
        if (data.deleted === true) {
          return;
        }
        // Skip pages we've recently used
        if (this.usedPageIds.has(doc.id)) {
          return;
        }
        pages.push({
          id: doc.id,
          title: data.title || 'Untitled'
        });
      });
      
      if (pages.length === 0) {
        console.error('No valid pages found after filtering');
        // If we've filtered out all pages, clear the used IDs and try again
        if (snapshot.size > 0) {
          this.usedPageIds.clear();
          await this.refillCache();
        }
        return;
      }
      
      // Shuffle the array to get random pages
      this.shuffleArray(pages);
      
      // Add new pages to the cache
      const newPages = pages.slice(0, this.cacheSize - this.cachedPages.length);
      this.cachedPages.push(...newPages);
      
      console.log(`Added ${newPages.length} pages to random page cache. Cache now has ${this.cachedPages.length} pages.`);
    } catch (error) {
      console.error('Error refilling random page cache:', error);
    }
  }

  /**
   * Get a random page from the cache
   * @returns {Object|null} A random page object with id and title, or null if cache is empty
   */
  async getRandomPage() {
    // Initialize if not already done
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // If cache is empty or running low, refill it
    if (this.cachedPages.length === 0) {
      await this.refillCache();
      
      // If still empty after refill, return null
      if (this.cachedPages.length === 0) {
        return null;
      }
    }
    
    // Get a page from the cache
    const randomPage = this.cachedPages.shift();
    
    // Add the page ID to the used set
    this.usedPageIds.add(randomPage.id);
    
    // If the used set is too large, remove the oldest entries
    if (this.usedPageIds.size > this.maxUsedPageIds) {
      const idsArray = Array.from(this.usedPageIds);
      const oldestId = idsArray[0];
      this.usedPageIds.delete(oldestId);
    }
    
    // If cache is running low, trigger a refill
    if (this.cachedPages.length < 2) {
      // Don't await this to avoid blocking
      this.refillCache();
    }
    
    return randomPage;
  }

  /**
   * Shuffle an array in place using the Fisher-Yates algorithm
   * @param {Array} array The array to shuffle
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

// Create a singleton instance
const randomPageCacheService = new RandomPageCacheService();

// Initialize the cache when the module is imported
if (typeof window !== 'undefined') {
  // Only initialize in the browser
  randomPageCacheService.initialize();
}

export default randomPageCacheService;
