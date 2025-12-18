"use client";

/**
 * WeWrite SEO Implementation - SEO Head Component
 *
 * Comprehensive SEO head component for dynamic meta tags and structured data
 * that optimizes WeWrite's user-generated content for search engines.
 */

import Head from 'next/head';
import { generateSchemaMarkup } from '../../utils/schemaMarkup';

interface Author {
  name: string;
  url?: string;
  twitter?: string;
}

interface Breadcrumb {
  name: string;
  url: string;
}

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl?: string;
  type?: 'article' | 'person' | 'group' | 'webpage';
  schemaData?: Record<string, unknown>;
  keywords?: string[];
  author?: Author | null;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  noIndex?: boolean;
  breadcrumbs?: Breadcrumb[];
}

/**
 * Comprehensive SEO Head component for user-generated content
 */
export default function SEOHead({
  title,
  description,
  canonicalUrl,
  imageUrl,
  type = 'webpage',
  schemaData = {},
  keywords = [],
  author = null,
  publishedTime = null,
  modifiedTime = null,
  noIndex = false,
  breadcrumbs = []
}: SEOHeadProps) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app';
  const defaultImage = `${baseUrl}/images/og-image.png`;
  const finalImageUrl = imageUrl || defaultImage;

  // Generate schema markup
  const schemaMarkup = generateSchemaMarkup(type, {
    title,
    description,
    url: canonicalUrl,
    imageUrl: finalImageUrl,
    datePublished: publishedTime,
    dateModified: modifiedTime,
    authorName: author?.name,
    authorUrl: author?.url,
    breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    })) : undefined,
    ...schemaData
  });

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Robots */}
      <meta name="robots" content={noIndex ? 'noindex,nofollow' : 'index,follow'} />
      <meta name="googlebot" content={noIndex ? 'noindex,nofollow' : 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1'} />

      {/* Author */}
      {author && <meta name="author" content={author.name} />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type === 'article' ? 'article' : 'website'} />
      <meta property="og:image" content={finalImageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      <meta property="og:site_name" content="WeWrite" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {author && <meta property="article:author" content={author.name} />}

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={finalImageUrl} />
      {author?.twitter && <meta name="twitter:creator" content={`@${author.twitter}`} />}

      {/* Additional Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />

      {/* Schema.org JSON-LD */}
      {schemaMarkup && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schemaMarkup)
          }}
        />
      )}

      {/* Breadcrumbs Schema (if provided) */}
      {breadcrumbs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: breadcrumbs.map((crumb, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: crumb.name,
                item: crumb.url
              }))
            })
          }}
        />
      )}
    </Head>
  );
}
