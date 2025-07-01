import { NextResponse } from 'next/server'
import { generateNewsSitemap } from '../../utils/sitemapGenerator'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const daysBack = parseInt(searchParams.get('days') || '2')
    const limit = parseInt(searchParams.get('limit') || '1000')
    
    const sitemap = await generateNewsSitemap({
      daysBack,
      limit
    })
    
    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800', // 30 minutes for news
        'X-Robots-Tag': 'noindex'
      }
    })
  } catch (error) {
    console.error('Error generating news sitemap:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
  }
}