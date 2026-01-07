import { NextResponse } from 'next/server'
import { generateUsersSitemap } from '../../utils/sitemapGenerator'

export const dynamic = 'force-dynamic'

// Set max duration to prevent Vercel function timeouts
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    // OPTIMIZED: Reduced default from 10000 to 1000 and capped at 2000 to prevent timeouts
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000'), 2000)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const sitemap = await generateUsersSitemap({
      limit,
      includeInactive
    })

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=7200, s-maxage=7200',
        'X-Robots-Tag': 'noindex'
      }
    })
  } catch (error) {
    console.error('Error generating users sitemap:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}