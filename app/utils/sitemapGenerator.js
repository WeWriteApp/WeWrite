"use server";

import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { ref, get } from 'firebase/database';
import { db } from '../firebase/database';
import { rtdb } from '../firebase/rtdb';

/**
 * Advanced sitemap generation utilities for WeWrite
 */

/**
 * Generate XML sitemap for pages
 * 
 * @param {Object} options - Generation options
 * @param {number} options.limit - Maximum number of URLs
 * @param {string} options.lastmod - Last modification filter
 * @param {boolean} options.includePrivate - Include private pages
 * @returns {string} - XML sitemap
 */
export async function generatePagesSitemap(options = {}) {
  const {
    limit: maxLimit = 50000,
    lastmod,
    includePrivate = false
  } = options;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app';
  
  try {
    // Build query
    let pageQuery = collection(db, 'pages');
    
    if (!includePrivate) {
      pageQuery = query(pageQuery, where('isPublic', '==', true));
    }
    
    if (lastmod) {
      pageQuery = query(pageQuery, where('lastModified', '>=', lastmod));
    }
    
    pageQuery = query(pageQuery, orderBy('lastModified', 'desc'), limit(maxLimit));
    
    const pagesSnapshot = await getDocs(pageQuery);
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;
    
    pagesSnapshot.forEach((doc) => {
      const page = doc.data();
      const lastModified = page.lastModified || page.createdAt;
      const lastModifiedDate = typeof lastModified === 'string' 
        ? lastModified 
        : lastModified?.toDate?.()?.toISOString() || new Date().toISOString();
      
      // Determine change frequency based on page activity
      const changefreq = getChangeFrequency(page);
      const priority = getPriority(page);
      
      sitemap += `  <url>
    <loc>${baseUrl}/${doc.id}</loc>
    <lastmod>${lastModifiedDate}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>`;

      // Add mobile annotation
      sitemap += `
    <mobile:mobile/>`;

      // Add image information if available
      if (page.images && page.images.length > 0) {
        page.images.forEach(image => {
          sitemap += `
    <image:image>
      <image:loc>${image.url}</image:loc>
      <image:title>${escapeXml(image.title || page.title || 'Image')}</image:title>
      <image:caption>${escapeXml(image.caption || '')}</image:caption>
    </image:image>`;
        });
      }

      sitemap += `
  </url>
`;
    });
    
    sitemap += `</urlset>`;
    
    return sitemap;
  } catch (error) {
    console.error('Error generating pages sitemap:', error);
    throw error;
  }
}

/**
 * Generate XML sitemap for users
 */
export async function generateUsersSitemap(options = {}) {
  const {
    limit: maxLimit = 10000,
    includeInactive = false
  } = options;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app';
  
  try {
    const usersRef = ref(rtdb, 'users');
    const usersSnapshot = await get(usersRef);
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      const userEntries = Object.entries(users)
        .filter(([_, userData]) => {
          // Filter criteria
          if (!userData.username) return false;
          if (!includeInactive && !userData.lastActive) return false;
          return true;
        })
        .slice(0, maxLimit);
      
      userEntries.forEach(([userId, userData]) => {
        const lastModified = userData.lastActive || userData.createdAt || new Date().toISOString();
        
        sitemap += `  <url>
    <loc>${baseUrl}/user/${userId}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
      });
    }
    
    sitemap += `</urlset>`;
    
    return sitemap;
  } catch (error) {
    console.error('Error generating users sitemap:', error);
    throw error;
  }
}

/**
 * Generate XML sitemap for groups
 */
export async function generateGroupsSitemap(options = {}) {
  const {
    includePrivate = false
  } = options;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app';
  
  try {
    const groupsRef = ref(rtdb, 'groups');
    const groupsSnapshot = await get(groupsRef);
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
    
    if (groupsSnapshot.exists()) {
      const groups = groupsSnapshot.val();
      
      Object.entries(groups).forEach(([groupId, groupData]) => {
        // Filter private groups if not included
        if (!includePrivate && groupData.isPublic === false) {
          return;
        }
        
        const lastModified = groupData.lastModified || groupData.createdAt || new Date().toISOString();
        
        sitemap += `  <url>
    <loc>${baseUrl}/group/${groupId}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
      });
    }
    
    sitemap += `</urlset>`;
    
    return sitemap;
  } catch (error) {
    console.error('Error generating groups sitemap:', error);
    throw error;
  }
}

/**
 * Generate sitemap index file
 */
export async function generateSitemapIndex() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app';
  const currentDate = new Date().toISOString();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/api/sitemap-pages</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/api/sitemap-users</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${baseUrl}/api/sitemap-groups</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
</sitemapindex>`;
}

/**
 * Generate news sitemap for recent content
 */
export async function generateNewsSitemap(options = {}) {
  const {
    daysBack = 2,
    limit: maxLimit = 1000
  } = options;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app';
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  try {
    const pageQuery = query(
      collection(db, 'pages'),
      where('isPublic', '==', true),
      where('createdAt', '>=', cutoffDate.toISOString()),
      orderBy('createdAt', 'desc'),
      limit(maxLimit)
    );
    
    const pagesSnapshot = await getDocs(pageQuery);
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
`;
    
    pagesSnapshot.forEach((doc) => {
      const page = doc.data();
      const publishDate = page.createdAt;
      const publishDateFormatted = typeof publishDate === 'string' 
        ? publishDate 
        : publishDate?.toDate?.()?.toISOString() || new Date().toISOString();
      
      sitemap += `  <url>
    <loc>${baseUrl}/${doc.id}</loc>
    <news:news>
      <news:publication>
        <news:name>WeWrite</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${publishDateFormatted}</news:publication_date>
      <news:title>${escapeXml(page.title || 'Untitled')}</news:title>
      <news:keywords>${escapeXml(generateKeywordsFromPage(page))}</news:keywords>
    </news:news>
  </url>
`;
    });
    
    sitemap += `</urlset>`;
    
    return sitemap;
  } catch (error) {
    console.error('Error generating news sitemap:', error);
    throw error;
  }
}

/**
 * Determine change frequency based on page activity
 */
function getChangeFrequency(page) {
  const now = new Date();
  const lastModified = new Date(page.lastModified || page.createdAt);
  const daysSinceModified = (now - lastModified) / (1000 * 60 * 60 * 24);
  
  if (daysSinceModified < 1) return 'hourly';
  if (daysSinceModified < 7) return 'daily';
  if (daysSinceModified < 30) return 'weekly';
  if (daysSinceModified < 365) return 'monthly';
  return 'yearly';
}

/**
 * Determine priority based on page characteristics
 */
function getPriority(page) {
  let priority = 0.5; // Base priority
  
  // Increase priority for popular pages
  if (page.views > 1000) priority += 0.2;
  if (page.views > 10000) priority += 0.1;
  
  // Increase priority for recent pages
  const daysSinceCreated = (new Date() - new Date(page.createdAt)) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated < 7) priority += 0.1;
  
  // Increase priority for pages with fundraising activity
  if (page.totalPledged > 0) priority += 0.1;
  
  // Increase priority for group pages
  if (page.groupId) priority += 0.05;
  
  return Math.min(1.0, priority).toFixed(1);
}

/**
 * Generate keywords from page data
 */
function generateKeywordsFromPage(page) {
  const keywords = [];
  
  if (page.tags) {
    keywords.push(...page.tags);
  }
  
  if (page.username) {
    keywords.push(page.username);
  }
  
  if (page.groupName) {
    keywords.push(page.groupName);
  }
  
  // Add default keywords
  keywords.push('writing', 'collaboration', 'wewrite');
  
  return keywords.join(', ');
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  if (!text) return '';
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Validate sitemap XML
 * Made async to comply with "use server" directive
 */
export async function validateSitemap(xmlContent) {
  const issues = [];

  // Check for required elements
  if (!xmlContent.includes('<urlset')) {
    issues.push('Missing urlset element');
  }

  if (!xmlContent.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
    issues.push('Missing or incorrect namespace');
  }

  // Check URL count (Google limit is 50,000)
  const urlMatches = xmlContent.match(/<url>/g);
  const urlCount = urlMatches ? urlMatches.length : 0;

  if (urlCount > 50000) {
    issues.push(`Too many URLs: ${urlCount} (limit: 50,000)`);
  }

  // Check file size (Google limit is 50MB uncompressed)
  const sizeInMB = new Blob([xmlContent]).size / (1024 * 1024);
  if (sizeInMB > 50) {
    issues.push(`File too large: ${sizeInMB.toFixed(2)}MB (limit: 50MB)`);
  }

  return {
    valid: issues.length === 0,
    issues,
    urlCount,
    sizeInMB: sizeInMB.toFixed(2)
  };
}
