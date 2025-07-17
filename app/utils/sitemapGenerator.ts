import { db } from '../firebase/config'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { ref, get } from 'firebase/database'
import { rtdb } from '../firebase/rtdb'
import { getCollectionName } from "../utils/environmentConfig";

interface SitemapOptions {
  limit?: number
  includePrivate?: boolean
  includeInactive?: boolean
}

interface SitemapEntry {
  url: string
  lastModified: Date
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

export async function generatePagesSitemap(options: SitemapOptions = {}): Promise<string> {
  const { limit: maxPages = 50000, includePrivate = false } = options
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'
  
  try {
    const pagesRef = collection(db, getCollectionName('pages'))
    let pagesQuery = query(
      pagesRef,
      where('isPublic', '==', true),
      orderBy('lastModified', 'desc'),
      limit(maxPages)
    )

    if (includePrivate) {
      // If including private pages, remove the isPublic filter
      pagesQuery = query(
        pagesRef,
        orderBy('lastModified', 'desc'),
        limit(maxPages)
      )
    }

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
      const lastModified = data.lastModified?.toDate() || new Date()
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
    throw error
  }
}

export async function generateUsersSitemap(options: SitemapOptions = {}): Promise<string> {
  const { limit: maxUsers = 10000 } = options
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'
  
  try {
    const usersRef = collection(db, getCollectionName('users'))
    const usersQuery = query(
      usersRef,
      orderBy('lastActive', 'desc'),
      limit(maxUsers)
    )

    const usersSnapshot = await getDocs(usersQuery)
    const entries: SitemapEntry[] = []

    usersSnapshot.forEach((doc) => {
      const data = doc.data()
      const userId = doc.id
      
      // Skip users without usernames or inactive users
      if (!data.username || !data.lastActive) {
        return
      }

      const lastActive = data.lastActive?.toDate() || new Date()
      const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
      
      // Only include users active within the last year
      if (daysSinceActive > 365) {
        return
      }

      let priority = 0.4
      if (daysSinceActive < 7) priority = 0.7
      else if (daysSinceActive < 30) priority = 0.6
      else if (daysSinceActive < 90) priority = 0.5

      entries.push({
        url: `${baseUrl}/user/${userId}`,
        lastModified: lastActive,
        changeFrequency: 'weekly',
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
    console.error('Error generating users sitemap:', error)
    throw error
  }
}

export async function generateGroupsSitemap(options: SitemapOptions = {}): Promise<string> {
  const { limit: maxGroups = 5000 } = options
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'
  
  try {
    // Query public groups from RTDB (not Firestore)
    const groupsRef = ref(rtdb, 'groups')
    const groupsSnapshot = await get(groupsRef)
    const entries: SitemapEntry[] = []

    // Groups functionality removed

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
    console.error('Error generating groups sitemap:', error)
    throw error
  }
}

export async function generateSitemapIndex(): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'

  const sitemaps = [
    { url: `${baseUrl}/sitemap-pages.xml`, lastmod: new Date().toISOString() },
    { url: `${baseUrl}/sitemap-users.xml`, lastmod: new Date().toISOString() },
    // Groups functionality removed
    { url: `${baseUrl}/sitemap-news.xml`, lastmod: new Date().toISOString() }
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
  const { limit: maxPages = 1000 } = options
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app'

  try {
    const pagesRef = collection(db, getCollectionName('pages'))
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 2) // Last 2 days for news

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