import { NextResponse } from 'next/server'
import { generateUsersSitemap } from '../../utils/sitemapGenerator'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10000')
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
