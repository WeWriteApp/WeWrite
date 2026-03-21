/**
 * Page View Service
 *
 * Shared utility for fetching page view data from the pageViews collection.
 * Used by both the trending API and the feed ranking system.
 */

import { getCollectionName } from '../utils/environmentConfig';

export interface PageViewData {
  total: number;
  hourly: number[];
}

/**
 * Batch fetch 24-hour page view data for multiple pages.
 * Uses db.getAll() for efficiency — only 2 Firestore reads (today + yesterday)
 * regardless of how many pages are requested.
 */
export async function getBatchPageViewData(db: any, pageIds: string[]): Promise<Map<string, PageViewData>> {
  const result = new Map<string, PageViewData>();

  if (pageIds.length === 0) return result;

  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentHour = now.getUTCHours();

    const pageViewsCollection = db.collection(getCollectionName('pageViews'));
    const todayRefs = pageIds.map(id => pageViewsCollection.doc(`${id}_${todayStr}`));
    const yesterdayRefs = pageIds.map(id => pageViewsCollection.doc(`${id}_${yesterdayStr}`));

    const [todayDocs, yesterdayDocs] = await Promise.all([
      db.getAll(...todayRefs),
      db.getAll(...yesterdayRefs)
    ]);

    const todayDataMap = new Map();
    const yesterdayDataMap = new Map();

    todayDocs.forEach((doc: any, index: number) => {
      if (doc.exists) {
        todayDataMap.set(pageIds[index], doc.data());
      }
    });

    yesterdayDocs.forEach((doc: any, index: number) => {
      if (doc.exists) {
        yesterdayDataMap.set(pageIds[index], doc.data());
      }
    });

    for (const pageId of pageIds) {
      const hourlyViews = Array(24).fill(0);
      let totalViews24h = 0;

      const yesterdayData = yesterdayDataMap.get(pageId);
      const todayData = todayDataMap.get(pageId);

      if (yesterdayData) {
        for (let hour = currentHour + 1; hour < 24; hour++) {
          const views = yesterdayData.hours?.[hour] || 0;
          hourlyViews[hour - (currentHour + 1)] = views;
          totalViews24h += views;
        }
      }

      if (todayData) {
        for (let hour = 0; hour <= currentHour; hour++) {
          const views = todayData.hours?.[hour] || 0;
          hourlyViews[hour + (24 - (currentHour + 1))] = views;
          totalViews24h += views;
        }
      }

      result.set(pageId, {
        total: totalViews24h,
        hourly: hourlyViews
      });
    }

    return result;
  } catch (error: any) {
    console.warn('Error batch fetching page view data:', error?.message);
    for (const pageId of pageIds) {
      result.set(pageId, { total: 0, hourly: Array(24).fill(0) });
    }
    return result;
  }
}
