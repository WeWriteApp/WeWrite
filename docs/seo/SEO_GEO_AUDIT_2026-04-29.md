# SEO + GEO Audit (April 29, 2026)

## Scope

This audit reviewed:
- Crawl and index directives (robots, metadata robots, canonical)
- Sitemap coverage and freshness
- Content page metadata and snippet generation
- Structured data quality for content pages
- GEO readiness (AI crawler discoverability and citation quality)

Primary goals:
- Ensure public writer content pages are indexable
- Ensure page body text is discoverable for snippets/descriptions
- Improve baseline technical SEO and AI-search performance

## Executive Summary

Overall status: Good foundation, medium-risk crawl/index gaps.

Strengths:
- Dynamic content pages have server-side metadata and canonical URLs.
- Public page body is rendered server-side for crawlers via ServerContentForSEO.
- Article microdata, breadcrumb schema, and FAQ schema are present.
- Multiple sitemaps exist (main, pages, users, news, index).

Main risks identified:
1. Utility/auth routes were indexable in metadata (low-value pages in SERPs).
2. Private-page index logic depended on one field and could miss visibility edge cases.
3. Legacy sitemap-index route had stale/non-existent endpoint reference.
4. Dynamic sitemap generation uses capped limits and no explicit multi-part discovery strategy in docs/process.

## Changes Applied During This Audit

### 1) Private page index hardening
- File: app/[id]/layout.tsx
- Change: robots index logic now checks all key privacy/deletion states:
  - metadata.isPublic !== false
  - metadata.visibility !== private
  - metadata.deleted !== true

Impact:
- Reduces accidental indexing risk for non-public content.

### 2) Added noindex for utility/auth routes
- Files:
  - app/search/layout.tsx
  - app/notifications/layout.tsx
  - app/new/layout.tsx
  - app/auth/layout.tsx
- Change: Added metadata robots with index false and follow true.

Impact:
- Keeps crawl focused on valuable public landing and content pages.
- Reduces low-intent SERP entries.

### 3) Fixed stale sitemap-index XML route
- File: app/sitemap-index.xml/route.ts
- Changes:
  - Canonical fallback domain aligned to https://www.getwewrite.app
  - Removed non-existent sitemap-groups entry
  - Added sitemap-news entry

Impact:
- Prevents broken sitemap discovery paths in legacy index route.

### 4) Added paginated public pages sitemap index
- Files:
   - app/utils/sitemapGenerator.ts
   - app/api/sitemap-pages-index/route.ts
   - app/robots.ts
   - app/sitemap-index.xml/route.ts
- Change:
   - New endpoint `/api/sitemap-pages-index` generates a sitemap index of cursor-based `/api/sitemap-pages` batches.
   - Main sitemap index now references `/api/sitemap-pages-index` for broader discovery.

Impact:
- Improves crawl discovery beyond a single capped page sitemap response.

### 5) Added GEO crawler guidance files
- Files:
   - public/llms.txt
   - public/llms-full.txt

Impact:
- Provides citation/canonical guidance for AI systems and improves generative discovery consistency.

### 6) Added runnable SEO/GEO health check command
- Files:
   - scripts/seo-audit.js
   - package.json (`seo:audit`, `seo:health`)

Impact:
- Enables repeatable validation of robots, sitemap endpoints, noindex directives, and llms.txt availability.

## Current SEO Status by Area

### A. Indexing of writer content pages
Status: Mostly good, improved in this audit.

Evidence:
- app/[id]/page.tsx generates per-page title/description/canonical and OG/Twitter metadata.
- app/[id]/layout.tsx adds robots controls and schema.
- app/components/seo/ServerContentForSEO.tsx renders article body in server HTML for crawler visibility.

Remaining gap:
- Need explicit monitoring to ensure all eligible public pages are discovered beyond current sitemap query limits.

### B. Body-content indexing and snippet quality
Status: Good baseline, needs consistency tuning.

Evidence:
- Article body is present in initial HTML via ServerContentForSEO.
- Description generation uses extracted body text and sentence-first heuristic.
- max-snippet is open for Googlebot in global metadata.

Improvements recommended:
- Add guardrails to avoid very short/boilerplate descriptions.
- Add richer excerpt generation for pages with lists/headings only.
- Validate rendered snippet text against Search Console URL Inspection samples.

### C. Sitemaps and crawl paths
Status: Functional but scalability-risky.

Evidence:
- Main sitemap plus dynamic pages/users/news and index are implemented.
- Robots references sitemap endpoints.

Gaps:
- API sitemap endpoints currently use capped limits and optional cursor inputs without a documented multi-part sitemap index rollout.
- There are two sitemap index routes in code paths (api and sitemap-index.xml), which can create maintenance drift.

### D. General technical SEO
Status: Moderate.

Strengths:
- Canonical support present on key dynamic routes.
- OG and Twitter tags broadly implemented.
- Structured data present on user-generated content pages.

Gaps:
- Some canonical/base URL handling is still environment-variable dependent in multiple files; consistency should be centralized.
- A few utility pages had noindex missing prior to this audit.

## GEO (Generative Engine Optimization) Assessment

Status: Promising foundation, not yet systematized.

What already helps GEO:
- Server-rendered body text and semantic HTML
- Article metadata and author/publisher context
- FAQ extraction support in structured data

High-impact GEO upgrades to add next:
1. Add an llms.txt (and optional llms-full.txt) policy file in public/ with:
   - Brand description
   - Core product pages
   - Content usage/citation guidance
   - Preferred canonical domain and contact
2. Add explicit source-of-truth blocks for key pages (where relevant):
   - Publish date, updated date, author, and concise summary near content start
3. Add citation-friendly structured data consistency:
   - Ensure all public content pages include stable author, dateModified, and canonical values.
4. Build AI-crawler observability:
   - Segment logs/user-agents for GPTBot, Google-Extended, PerplexityBot, ClaudeBot, etc.

## Priority Backlog (Recommended)

### P0 (this week)
1. Submit and verify sitemap endpoints in Google Search Console and Bing Webmaster.
2. Decide one canonical sitemap index endpoint and deprecate the other path in docs.
3. Add monitoring job/report: indexed public pages vs expected public pages count.

### P1 (next 1-2 sprints)
1. Implement segmented/multipart page sitemap generation beyond capped limits.
2. Centralize base URL and canonical builder usage in all metadata/sitemap files.
3. Add llms.txt and GEO policy doc under docs/seo.

### P2 (next month)
1. Add content quality checks for snippet generation (minimum excerpt quality score).
2. Add richer schema variants for eligible pages (HowTo, QAPage where valid).
3. Add a recurring SEO health checklist with owner and SLA.

## Validation Checklist

After deployment, validate:
- Search route, auth route, notifications route, and new route return noindex in metadata.
- Public content pages still show index/follow and canonical URLs.
- Private/deleted pages resolve to non-indexable robots metadata.
- /api/sitemap-index and /sitemap-index.xml both produce valid, current entries.
- URL Inspection for 5 random public content pages shows body text in rendered HTML.

## Related Documentation

- docs/seo/UGC_SEO_ARCHITECTURE.md
- docs/seo/KEYWORD_EXPANSION_PLAN.md

---

Audit owner: GitHub Copilot
Date: 2026-04-29
