import { NextResponse } from 'next/server'
import { generatePagesSitemapIndex } from '../../utils/sitemapGenerator'

export const dynamic = 'force-dynamic'

// Set max duration to prevent Vercel function timeouts
export const maxDuration = 30

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const batchSize = Math.min(Math.max(parseInt(searchParams.get('batchSize') || '1000'), 100), 2000)
    const maxSitemaps = Math.min(Math.max(parseInt(searchParams.get('maxSitemaps') || '20'), 1), 100)

    const sitemapIndex = await generatePagesSitemapIndex({
      batchSize,
      maxSitemaps,
    })

    return new NextResponse(sitemapIndex, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Robots-Tag': 'noindex'
      }
    })
  } catch (error) {
    console.error('Error generating pages sitemap index:', error)
    return new NextResponse('Error generating sitemap index', { status: 500 })
  }
}