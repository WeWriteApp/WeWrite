"use client";

import { db } from "../firebase/config";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { getFollowedPages } from "../firebase/follows";
import { generateCacheKey, setCacheItem } from "./cacheUtils";
import { getCollectionName } from "./environmentConfig";
import type { Page } from '../types/database';

/**
 * Page data type for prefetching - uses centralized Page type with additional fields
 */
type PageData = Partial<Page> & { id: string; authorName?: string; [key: string]: unknown };

interface CacheData {
  public: PageData[];
  private: PageData[];
  hasMorePublic: boolean;
  hasMorePrivate: boolean;
}

interface ActivityData {
  id: string;
  pageId: string;
  title: string;
  content: string;
  userId?: string;
  authorName: string;
  lastModified?: string;
  isPublic?: boolean;
}

export const prefetchUserData = async (userId: string): Promise<void> => {
  if (!userId) return;

  console.log('Prefetching data for user:', userId);

  try {
    await prefetchUserPages(userId);
    await prefetchRecentActivity(userId);
    await prefetchFollowedPages(userId);

    console.log('Data prefetching complete for user:', userId);
  } catch (error) {
    console.error('Error prefetching user data:', error);
  }
};

const prefetchUserPages = async (userId: string): Promise<void> => {
  try {
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('userId', '==', userId),
      where('deleted', '!=', true),
      orderBy('lastModified', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(pagesQuery);

    if (snapshot.empty) {
      return;
    }

    const pages: PageData[] = [];
    const privatePages: PageData[] = [];

    snapshot.forEach((doc) => {
      const pageData: PageData = { id: doc.id, ...doc.data() };

      if (pageData.isPublic) {
        pages.push(pageData);
      } else {
        privatePages.push(pageData);
      }
    });

    const cacheKey = generateCacheKey('pages', userId, 'all_' + userId);
    const cacheData: CacheData = {
      public: pages,
      private: privatePages,
      hasMorePublic: pages.length >= 20,
      hasMorePrivate: privatePages.length >= 20
    };

    setCacheItem(cacheKey, cacheData, 5 * 60 * 1000);

    console.log(`Prefetched ${pages.length} pages and ${privatePages.length} private pages for user:`, userId);
  } catch (error) {
    console.error('Error prefetching user pages:', error);
  }
};

const prefetchRecentActivity = async (userId: string): Promise<void> => {
  try {
    const pagesQuery = query(
      collection(db, getCollectionName('pages')),
      where('isPublic', '==', true),
      where('deleted', '!=', true),
      orderBy('lastModified', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(pagesQuery);

    if (snapshot.empty) {
      return;
    }

    const activities: ActivityData[] = snapshot.docs
      .map(doc => {
        const data = doc.data();

        if (data.deleted === true) return null;

        return {
          id: doc.id,
          pageId: doc.id,
          title: data.title || 'Untitled',
          content: data.content || '',
          userId: data.userId,
          authorName: data.authorName || 'Anonymous',
          lastModified: data.lastModified,
          isPublic: data.isPublic
        };
      })
      .filter((activity): activity is ActivityData => activity !== null);

    const cacheKey = `home_activity_${userId || 'anonymous'}_all_10`;
    setCacheItem(cacheKey, activities, 5 * 60 * 1000);

    console.log(`Prefetched ${activities.length} recent activities`);
  } catch (error) {
    console.error('Error prefetching recent activity:', error);
  }
};

const prefetchFollowedPages = async (userId: string): Promise<void> => {
  try {
    const followedPageIds = await getFollowedPages(userId);

    if (followedPageIds.length === 0) {
      return;
    }

    const followCacheKey = `followed_pages_${userId}`;
    setCacheItem(followCacheKey, followedPageIds, 5 * 60 * 1000);

    console.log(`Prefetched ${followedPageIds.length} followed page IDs for user:`, userId);
  } catch (error) {
    console.error('Error prefetching followed pages:', error);
  }
};

export default prefetchUserData;
