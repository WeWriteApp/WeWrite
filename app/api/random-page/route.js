import { NextResponse } from 'next/server';
import { db } from '../../firebase/config';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';

// Track used page IDs to avoid repeats
const usedPageIds = new Set();
const MAX_USED_PAGE_IDS = 20; // Maximum number of page IDs to remember

// Cache for random pages
let pageCache = [];
let lastCacheRefill = 0;
const CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes in milliseconds

// Force a new random page on each request
let lastServedPageId = null;

/**
 * Shuffle an array in place using the Fisher-Yates algorithm
 * @param {Array} array The array to shuffle
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * API route to get a random page
 *
 * @returns {Promise<NextResponse>} - Response with a random page ID
 */
export async function GET(req) {
  try {
    console.log('Random page API called');

    // Check if we need to refill the cache
    const now = Date.now();
    const shouldRefillCache = pageCache.length === 0 || (now - lastCacheRefill) > CACHE_LIFETIME;

    if (shouldRefillCache) {
      console.log('Refilling random page cache');
      lastCacheRefill = now;

      // Query for public pages
      const pagesRef = collection(db, 'pages');
      const publicPagesQuery = query(
        pagesRef,
        where('isPublic', '==', true),
        limit(100) // Limit to 100 pages for performance
      );

      console.log('Executing Firestore query for random page cache');
      const snapshot = await getDocs(publicPagesQuery);

      if (snapshot.empty) {
        console.error('No pages found in the database');
        return NextResponse.json({ error: 'No pages found' }, { status: 404 });
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
        if (usedPageIds.has(doc.id)) {
          return;
        }
        pages.push({
          id: doc.id,
          title: data.title || 'Untitled'
        });
      });

      console.log(`Found ${pages.length} pages for random selection`);

      if (pages.length === 0) {
        // If we've filtered out all pages due to usedPageIds, clear it and try again
        if (snapshot.size > 0 && usedPageIds.size > 0) {
          console.log('Clearing used page IDs and retrying');
          usedPageIds.clear();

          // Try again with the same snapshot
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.deleted !== true) {
              pages.push({
                id: doc.id,
                title: data.title || 'Untitled'
              });
            }
          });
        }

        // If still empty, return error
        if (pages.length === 0) {
          console.error('No valid pages found after filtering');
          return NextResponse.json({ error: 'No valid pages found' }, { status: 404 });
        }
      }

      // Shuffle the array to get random pages
      shuffleArray(pages);

      // Store in cache
      pageCache = pages;
    }

    // Get a page from the cache that's not the same as the last one served
    let randomPage;

    // If we have more than one page in the cache and the first one is the same as the last served,
    // move it to the end of the array
    if (pageCache.length > 1 && pageCache[0].id === lastServedPageId) {
      const firstPage = pageCache.shift();
      pageCache.push(firstPage);
    }

    randomPage = pageCache.shift();

    // Add the page ID to the used set
    usedPageIds.add(randomPage.id);
    lastServedPageId = randomPage.id;

    // If the used set is too large, remove the oldest entries
    if (usedPageIds.size > MAX_USED_PAGE_IDS) {
      const idsArray = Array.from(usedPageIds);
      const oldestId = idsArray[0];
      usedPageIds.delete(oldestId);
    }

    console.log(`Selected random page: ${randomPage.id} - ${randomPage.title}`);

    // Track this in analytics if the prefetch parameter is not set
    // (prefetch requests shouldn't count as actual random page views)
    const isPrefetch = req?.nextUrl?.searchParams?.get('prefetch') === 'true';
    if (!isPrefetch) {
      // In a real implementation, you would log this to your analytics service
      console.log('Random page viewed:', randomPage.id);
    }

    return NextResponse.json({
      pageId: randomPage.id,
      title: randomPage.title
    });
  } catch (error) {
    console.error('Error getting random page:', error);
    return NextResponse.json({ error: 'Failed to get random page' }, { status: 500 });
  }
}
