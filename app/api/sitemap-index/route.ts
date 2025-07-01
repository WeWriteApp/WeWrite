import { NextResponse } from 'next/server'
import { generateSitemapIndex } from '../../utils/sitemapGenerator'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sitemapIndex = await generateSitemapIndex()
    
    return new NextResponse(sitemapIndex, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Robots-Tag': 'noindex'
      }
    })
  } catch (error) {
    console.error('Error generating sitemap index:', error)
    return new NextResponse('Error generating sitemap index', { status: 500 })
  }
}