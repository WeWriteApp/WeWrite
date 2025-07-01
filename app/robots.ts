import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/user/',
          '/group/',
          '/api/og/',
          '/api/sitemap'
        ],
        disallow: [
          '/admin/',
          '/api/',
          '/auth/',
          '/dashboard/',
          '/settings/subscription/',
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
      `${baseUrl}/sitemap-pages.xml`,
      `${baseUrl}/sitemap-users.xml`,
      `${baseUrl}/sitemap-groups.xml`
    ]
  }
}