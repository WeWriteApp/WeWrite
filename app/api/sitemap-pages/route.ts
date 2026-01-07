import { NextResponse } from 'next/server'
import { generatePagesSitemap } from '../../utils/sitemapGenerator'

export const dynamic = 'force-dynamic'

// Set max duration to prevent Vercel function timeouts
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    // OPTIMIZED: Reduced default from 5000 to 1000 to prevent timeouts
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 2000)
    const includePrivate = searchParams.get('includePrivate') === 'true'
    const cursor = searchParams.get('cursor') || undefined

    const sitemap = await generatePagesSitemap({
      limit,
      includePrivate,
      cursor
    })

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Robots-Tag': 'noindex'
      }
    })
  } catch (error) {
    console.error('Error generating pages sitemap:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new NextResponse(`Error generating sitemap: ${errorMessage}`, { status: 500 })
  }
}