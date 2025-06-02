import { db } from '../firebase/config'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'

interface SitemapOptions {
  limit?: number
  includePrivate?: boolean
}

interface SitemapEntry {
  url: string
  lastModified: Date
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

export async function generatePagesSitemap(options: SitemapOptions = {}): Promise<string> {
  const { limit: maxPages = 50000, includePrivate = false } = options
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app'
  
  try {
    // Query public pages from Firestore
    const pagesRef = collection(db, 'pages')
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app'
  
  try {
    // Query active users from Firestore
    const usersRef = collection(db, 'users')
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app'
  
  try {
    // Query public groups from Firestore
    const groupsRef = collection(db, 'groups')
    const groupsQuery = query(
      groupsRef,
      where('isPublic', '==', true),
      orderBy('lastActivity', 'desc'),
      limit(maxGroups)
    )

    const groupsSnapshot = await getDocs(groupsQuery)
    const entries: SitemapEntry[] = []

    groupsSnapshot.forEach((doc) => {
      const data = doc.data()
      const groupId = doc.id
      
      const lastActivity = data.lastActivity?.toDate() || data.createdAt?.toDate() || new Date()
      const memberCount = data.memberCount || 0

      let priority = 0.5
      if (memberCount > 100) priority = 0.8
      else if (memberCount > 20) priority = 0.7
      else if (memberCount > 5) priority = 0.6

      entries.push({
        url: `${baseUrl}/group/${groupId}`,
        lastModified: lastActivity,
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
    console.error('Error generating groups sitemap:', error)
    throw error
  }
}
