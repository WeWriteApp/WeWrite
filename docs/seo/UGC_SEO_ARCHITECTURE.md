# User-Generated Content SEO Architecture

This document describes WeWrite's SEO strategy for user-generated content (UGC) - ensuring pages created by users are properly indexed by search engines.

## Current Implementation Status

### What's Working Well

#### 1. Metadata Generation (`app/[id]/page.tsx` & `app/[id]/layout.tsx`)
- **Title tags**: Dynamic titles based on page content (e.g., "My Article by username")
- **Meta descriptions**: First 160 characters of page content
- **Canonical URLs**: Properly set to `https://www.getwewrite.app/{pageId}`
- **Open Graph tags**: Full OG implementation for social sharing
- **Twitter cards**: Summary large image cards

#### 2. Structured Data / JSON-LD (`app/[id]/layout.tsx`)
- **Article schema**: Each page has Article structured data with:
  - `headline`, `description`, `datePublished`, `dateModified`
  - `author` (Person) or `publisher` (Organization for group pages)
  - `mainEntityOfPage` with canonical URL
- **BreadcrumbList schema**: Navigation hierarchy for better SERP display
  - Home > Author > Page Title (for user pages)
  - Home > Group > Page Title (for group pages)

#### 3. Sitemaps (`app/utils/sitemapGenerator.ts`)
- **Main sitemap** (`/sitemap.xml`): Static pages and navigation
- **Pages sitemap** (`/api/sitemap-pages`): All public user pages (up to 5,000)
- **Users sitemap** (`/api/sitemap-users`): Active user profiles
- **News sitemap** (`/api/sitemap-news`): Recent content (last 2 days)
- **Sitemap index** (`/api/sitemap-index`): Aggregates all sitemaps

Priority is dynamic based on view count:
- >1000 views: 0.8
- >100 views: 0.7
- >10 views: 0.6
- Default: 0.5

#### 4. Robots.txt (`app/robots.ts`)
- Allows crawling of public content: `/`, `/u/`, `/user/`, `/group/`, `/trending`, etc.
- Blocks private areas: `/admin/`, `/settings/`, `/notifications/`, `?edit=true`, `?private=true`
- Includes all sitemap references
- Sets `crawlDelay: 1` to be respectful to crawlers

#### 5. OpenGraph Images (`app/[id]/opengraph-image.tsx`)
- Dynamic OG image generation for each page
- Shows: Title, content preview (with styled links), author, sponsor count
- 1200x630 resolution
- Fallback to WeWrite branding if page not found

#### 6. Server-Side Content Rendering (`app/components/seo/ServerContentForSEO.tsx`) ✅ IMPLEMENTED

**Solution**: We render page content server-side using the `ServerContentForSEO` component, which is included alongside the client-side interactive editor.

```tsx
// In app/[id]/page.tsx (success case)
return (
  <>
    {/* Server-rendered content for SEO crawlers */}
    {pageData && (
      <ServerContentForSEO
        title={pageData.title || 'Untitled'}
        content={pageData.content}
        authorUsername={pageData.authorUsername || pageData.username}
        createdAt={pageData.created}
        lastModified={pageData.lastModified}
        pageId={id}
        // Engagement stats for Schema.org interactionStatistic
        viewCount={pageData.viewCount || pageData.views}
        sponsorCount={pageData.sponsorCount}
        replyCount={pageData.replyCount}
      />
    )}
    {/* Interactive client component */}
    <Suspense fallback={<ContentPageSkeleton />}>
      <ContentPageClient pageId={id} initialStatus="page" initialPageData={pageData} />
    </Suspense>
  </>
);
```

**Data sources** (fetched in `app/api/pages/[id]/route.ts`):
- `viewCount`: From page document
- `sponsorCount`: Count of unique users who allocated USD to this page
- `replyCount`: Count of non-deleted pages that reply to this page

**How it works**:
- Content is rendered as semantic HTML with Schema.org microdata
- Uses `sr-only` class (visually hidden but accessible to crawlers)
- Includes `<noscript>` fallback for crawlers that don't execute JS
- Parses Slate.js content structure into plain HTML
- Preserves internal links for crawl discovery

**What's included in the SEO content**:
- Article headline and description
- Word count
- Canonical URL
- Published/modified dates (both `datePublished` and `dateModified`)
- Author information (when available)
- Publisher information (WeWrite)
- Full article body as semantic HTML
- **Engagement metrics** via Schema.org `interactionStatistic`:
  - `ReadAction` with view count (signals popularity)
  - `DonateAction` with sponsor count (signals trust/quality)
  - `CommentAction` with reply count + `commentCount` property

## Future Improvements

### Priority 1: Enhanced Structured Data

Add more schema types for better rich results:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "articleBody": "Full text content here...",
  "wordCount": 1500,
  "image": {
    "@type": "ImageObject",
    "url": "https://www.getwewrite.app/{id}/opengraph-image"
  },
  "interactionStatistic": {
    "@type": "InteractionCounter",
    "interactionType": "https://schema.org/ReadAction",
    "userInteractionCount": 1234
  }
}
```

### Priority 3: Additional SEO Enhancements

1. **FAQ Schema** for pages with Q&A content
2. **HowTo Schema** for tutorial/guide pages
3. **Review Schema** if pages have ratings/reviews
4. **Internal linking signals** - expose outgoing/incoming link counts

### Priority 4: Technical SEO

1. **Core Web Vitals** - Monitor LCP/FID/CLS for content pages
2. **Mobile-first indexing** - Ensure content looks good on mobile Googlebot
3. **Pagination** for long content - Consider `rel="next"` / `rel="prev"`
4. **Hreflang** - If supporting multiple languages

## Testing SEO Implementation

### Tools to Use

1. **Google Search Console**
   - URL Inspection tool for individual pages
   - Coverage report for indexing status
   - Rich results report for structured data

2. **Google Rich Results Test**
   - https://search.google.com/test/rich-results
   - Test individual URLs for schema validation

3. **Schema Markup Validator**
   - https://validator.schema.org/
   - Validate JSON-LD syntax

4. **Mobile-Friendly Test**
   - https://search.google.com/test/mobile-friendly

5. **Lighthouse**
   - SEO audit in Chrome DevTools

### Manual Testing

```bash
# View rendered HTML without JS
curl -A "Googlebot" https://www.getwewrite.app/{pageId}

# Check if content is in initial HTML
curl https://www.getwewrite.app/{pageId} | grep -i "page content text"
```

## File Reference

| File | Purpose |
|------|---------|
| `app/[id]/page.tsx` | Page component with metadata generation |
| `app/[id]/layout.tsx` | JSON-LD structured data |
| `app/[id]/opengraph-image.tsx` | Dynamic OG image generation |
| `app/[id]/ContentPageClient.tsx` | Client-side content rendering |
| `app/components/seo/ServerContentForSEO.tsx` | Server-rendered SEO content |
| `app/sitemap.ts` | Static pages sitemap |
| `app/robots.ts` | Crawler directives |
| `app/utils/sitemapGenerator.ts` | Dynamic sitemap generation |
| `app/api/sitemap-pages/route.ts` | Pages sitemap API |
| `app/api/sitemap-users/route.ts` | Users sitemap API |
| `app/api/sitemap-news/route.ts` | News sitemap API |

## Monitoring

### Key Metrics to Track

1. **Index Coverage** - % of public pages indexed
2. **Impressions** - Search visibility
3. **Click-through Rate** - SERP performance
4. **Rich Results** - Schema markup adoption

### Search Console Queries

Monitor performance for:
- Brand queries: "wewrite"
- Content queries: page titles, topics
- Author queries: username searches

---

Last updated: December 22, 2024
