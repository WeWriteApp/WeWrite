import { NextResponse } from 'next/server'
import { generatePagesSitemap } from '../../utils/sitemapGenerator'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50000')
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
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}
