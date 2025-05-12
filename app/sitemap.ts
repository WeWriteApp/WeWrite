import { MetadataRoute } from 'next';
import { getDatabase, ref, get, query, orderByChild, limitToLast } from 'firebase/database';
import { collection, getDocs, query as firestoreQuery, where, limit, orderBy } from 'firebase/firestore';
import { db } from './firebase/config';
import { app } from './firebase/config';

// Maximum number of pages to include in the sitemap
const MAX_PAGES = 1000;
// Maximum number of users to include in the sitemap
const MAX_USERS = 500;
// Maximum number of groups to include in the sitemap
const MAX_GROUPS = 200;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app';
  const sitemapEntries: MetadataRoute.Sitemap = [];
  
  // Add static pages
  sitemapEntries.push({
    url: `${baseUrl}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
  });
  
  try {
    // Get public pages from Firestore
    const pagesQuery = firestoreQuery(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc'),
      limit(MAX_PAGES)
    );
    
    const pagesSnapshot = await getDocs(pagesQuery);
    
    // Add pages to sitemap
    pagesSnapshot.forEach((doc) => {
      const pageData = doc.data();
      sitemapEntries.push({
        url: `${baseUrl}/${doc.id}`,
        lastModified: pageData.lastModified ? new Date(pageData.lastModified) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    });
    
    // Get users from Realtime Database
    const rtdb = getDatabase(app);
    const usersRef = ref(rtdb, 'users');
    const usersQuery = query(usersRef, orderByChild('lastActive'), limitToLast(MAX_USERS));
    const usersSnapshot = await get(usersQuery);
    
    // Add users to sitemap
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      Object.entries(users).forEach(([userId, userData]: [string, any]) => {
        // Only include users with a username
        if (userData.username) {
          sitemapEntries.push({
            url: `${baseUrl}/user/${userData.username}`,
            lastModified: userData.lastActive ? new Date(userData.lastActive) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      });
    }
    
    // Get public groups from Realtime Database
    const groupsRef = ref(rtdb, 'groups');
    const groupsQuery = query(groupsRef, orderByChild('isPrivate'), limitToLast(MAX_GROUPS));
    const groupsSnapshot = await get(groupsQuery);
    
    // Add groups to sitemap
    if (groupsSnapshot.exists()) {
      const groups = groupsSnapshot.val();
      Object.entries(groups).forEach(([groupId, groupData]: [string, any]) => {
        // Only include public groups
        if (!groupData.isPrivate) {
          sitemapEntries.push({
            url: `${baseUrl}/group/${groupId}`,
            lastModified: groupData.lastModified ? new Date(groupData.lastModified) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
          });
        }
      });
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return at least the static pages if there's an error
  }
  
  return sitemapEntries;
}
