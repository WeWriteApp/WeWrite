import { NextResponse } from 'next/server'
import { generateGroupsSitemap } from '../../utils/sitemapGenerator'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const includePrivate = searchParams.get('includePrivate') === 'true'

    const sitemap = await generateGroupsSitemap({
      includePrivate
    })

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=7200, s-maxage=7200',
        'X-Robots-Tag': 'noindex'
      }
    })
  } catch (error) {
    console.error('Error generating groups sitemap:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}
