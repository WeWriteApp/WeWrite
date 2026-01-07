import { firestore } from '../firebase/config'
import { collection, query, where, orderBy, limit, getDocs, startAfter, doc, getDoc } from 'firebase/firestore'
import { getCollectionName } from "../utils/environmentConfig";

interface SitemapOptions {
  limit?: number
  includePrivate?: boolean
  includeInactive?: boolean
  daysBack?: number // For news sitemap - how many days back to include
  cursor?: string // For pagination - last page ID from previous batch
}

interface SitemapEntry {
  url: string
  lastModified: Date
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

export async function generatePagesSitemap(options: SitemapOptions = {}): Promise<string> {
  // OPTIMIZED: Reduced default from 5000 to 1000 to prevent timeouts
  const { limit: maxPages = 1000, includePrivate = false, cursor } = options
  // Use www.getwewrite.app as the canonical domain
  const baseUrl = 'https://www.getwewrite.app'

  try {
    const pagesRef = collection(firestore, getCollectionName('pages'))

    // Build base query constraints
    const queryConstraints: any[] = []

    if (!includePrivate) {
      queryConstraints.push(where('isPublic', '==', true))
    }
    queryConstraints.push(orderBy('lastModified', 'desc'))

    // If cursor provided, start after that document
    if (cursor) {
      const cursorDoc = await getDoc(doc(pagesRef, cursor))
      if (cursorDoc.exists()) {
        queryConstraints.push(startAfter(cursorDoc))
      }
    }

    queryConstraints.push(limit(maxPages))

    const pagesQuery = query(pagesRef, ...queryConstraints)
    const pagesSnapshot = await getDocs(pagesQuery)
    const entries: SitemapEntry[] = []

    pagesSnapshot.forEach((doc) => {
      const data = doc.data()
      const pageId = doc.id
      
      // Skip private pages if not including them
      if (!includePrivate && data.isPublic === false) {
        return
      }

      // Determine priority based on page characteristics
      let priority = 0.5
      if (data.viewCount > 1000) priority = 0.8
      else if (data.viewCount > 100) priority = 0.7
      else if (data.viewCount > 10) priority = 0.6

      // Determine change frequency based on last modified date
      // Handle both Firestore Timestamp and plain Date/number
      let lastModified: Date
      if (data.lastModified?.toDate) {
        lastModified = data.lastModified.toDate()
      } else if (data.lastModified instanceof Date) {
        lastModified = data.lastModified
      } else if (typeof data.lastModified === 'number') {
        lastModified = new Date(data.lastModified)
      } else {
        lastModified = new Date()
      }
      const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)
      
      let changeFrequency: SitemapEntry['changeFrequency'] = 'monthly'
      if (daysSinceModified < 1) changeFrequency = 'hourly'
      else if (daysSinceModified < 7) changeFrequency = 'daily'
      else if (daysSinceModified < 30) changeFrequency = 'weekly'

      entries.push({
        url: `${baseUrl}/${pageId}`,
        lastModified,
        changeFrequency,
        priority
      })
    })

    // Generate XML sitemap
    const xmlEntries = entries.map(entry => `
  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified.toISOString()}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${xmlEntries}
</urlset>`

  } catch (error) {
    console.error('Error generating pages sitemap:', error)
    console.error('Collection name:', getCollectionName('pages'))
    throw error
  }
}

export async function generateUsersSitemap(options: SitemapOptions = {}): Promise<string> {
  // OPTIMIZED: Reduced default from 5000 to 1000 to prevent timeouts
  const { limit: maxUsers = 1000 } = options
  // Use www.getwewrite.app as the canonical domain
  const baseUrl = 'https://www.getwewrite.app'

  try {
    const usersRef = collection(firestore, getCollectionName('users'))
    // Query users - just get all users and filter in memory since field names vary
    const usersQuery = query(
      usersRef,
      limit(maxUsers)
    )

    const usersSnapshot = await getDocs(usersQuery)
    const entries: SitemapEntry[] = []

    usersSnapshot.forEach((doc) => {
      const data = doc.data()
      const userId = doc.id

      // Skip users without usernames
      if (!data.username) {
        return
      }

      // Handle both lastActive and lastActiveAt field names, and multiple date formats
      const rawLastActive = data.lastActive || data.lastActiveAt || data.lastModified || data.createdAt
      let lastActive: Date

      if (rawLastActive?.toDate) {
        lastActive = rawLastActive.toDate()
      } else if (rawLastActive instanceof Date) {
        lastActive = rawLastActive
      } else if (typeof rawLastActive === 'string') {
        lastActive = new Date(rawLastActive)
      } else if (typeof rawLastActive === 'number') {
        lastActive = new Date(rawLastActive)
      } else {
        // No activity date found, skip this user
        return
      }

      // Validate the date is valid
      if (isNaN(lastActive.getTime())) {
        return
      }

      const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)

      // Only include users active within the last year
      if (daysSinceActive > 365) {
        return
      }

      let priority = 0.4
      if (daysSinceActive < 7) priority = 0.7
      else if (daysSinceActive < 30) priority = 0.6
      else if (daysSinceActive < 90) priority = 0.5

      // Use username-based URL for better SEO
      entries.push({
        url: `${baseUrl}/u/${data.username}`,
        lastModified: lastActive,
        changeFrequency: 'weekly',
        priority
      })
    })

    // Sort entries by lastModified descending
    entries.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())

    // Generate XML sitemap
    const xmlEntries = entries.map(entry => `
  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified.toISOString()}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${xmlEntries}
</urlset>`

  } catch (error) {
    console.error('Error generating users sitemap:', error)
    throw error
  }
}

// Note: generateGroupsSitemap was removed - groups functionality has been deprecated

export async function generateSitemapIndex(): Promise<string> {
  // Use www.getwewrite.app as the canonical domain
  const baseUrl = 'https://www.getwewrite.app'

  const sitemaps = [
    { url: `${baseUrl}/sitemap.xml`, lastmod: new Date().toISOString() },
    { url: `${baseUrl}/api/sitemap-pages`, lastmod: new Date().toISOString() },
    { url: `${baseUrl}/api/sitemap-users`, lastmod: new Date().toISOString() },
    { url: `${baseUrl}/api/sitemap-news`, lastmod: new Date().toISOString() }
  ]

  const xmlEntries = sitemaps.map(sitemap => `
  <sitemap>
    <loc>${sitemap.url}</loc>
    <lastmod>${sitemap.lastmod}</lastmod>
  </sitemap>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${xmlEntries}
</sitemapindex>`
}

export async function generateNewsSitemap(options: SitemapOptions = {}): Promise<string> {
  const { limit: maxPages = 1000, daysBack = 2 } = options
  // Use www.getwewrite.app as the canonical domain
  const baseUrl = 'https://www.getwewrite.app'

  try {
    const pagesRef = collection(firestore, getCollectionName('pages'))
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - daysBack) // Use daysBack parameter

    const pagesQuery = query(
      pagesRef,
      where('isPublic', '==', true),
      where('lastModified', '>=', recentDate),
      orderBy('lastModified', 'desc'),
      limit(maxPages)
    )

    const pagesSnapshot = await getDocs(pagesQuery)
    const entries: Array<{
      url: string
      lastModified: Date
      title: string
    }> = []

    pagesSnapshot.forEach((doc) => {
      const data = doc.data()
      const pageId = doc.id

      entries.push({
        url: `${baseUrl}/${pageId}`,
        lastModified: data.lastModified?.toDate() || new Date(),
        title: data.title || 'Untitled'
      })
    })

    // Generate XML news sitemap
    const xmlEntries = entries.map(entry => `
  <url>
    <loc>${entry.url}</loc>
    <news:news>
      <news:publication>
        <news:name>WeWrite</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${entry.lastModified.toISOString()}</news:publication_date>
      <news:title>${entry.title}</news:title>
    </news:news>
  </url>`).join('')

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  ${xmlEntries}
</urlset>`

  } catch (error) {
    console.error('Error generating news sitemap:', error)
    throw error
  }
}