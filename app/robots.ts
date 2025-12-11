import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  // Use www.getwewrite.app as the canonical domain
  const baseUrl = 'https://www.getwewrite.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/user/',
          '/group/',
          '/trending',
          '/leaderboard',
          '/groups',
          '/users',
          '/api/og/',
          '/api/sitemap-pages',
          '/api/sitemap-users',
          '/api/sitemap-index'
        ],
        disallow: [
          '/admin/',
          '/api/',
          '/auth/',
          '/dashboard/',
          '/settings/',
          '/new',
          '/create',
          '/scripts/',
          '/search',
          '/activity',
          '/notifications',
          '/*?edit=true',
          '/*?private=true'
        ],
        crawlDelay: 1
      }
    ],
    sitemap: [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/api/sitemap-pages`,
      `${baseUrl}/api/sitemap-users`,
      `${baseUrl}/api/sitemap-index`
    ]
  }
}