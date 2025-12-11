import { NextResponse } from 'next/server'
import { generatePagesSitemap } from '../../utils/sitemapGenerator'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '5000')
    const includePrivate = searchParams.get('includePrivate') === 'true'

    const sitemap = await generatePagesSitemap({
      limit,
      includePrivate
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