"use client";

/**
 * WeWrite SEO Implementation - Schema.org Markup Generator
 *
 * This module generates comprehensive Schema.org structured data markup
 * for WeWrite's user-generated content to improve search engine understanding.
 *
 * Supported Schema Types:
 * - Article: For user pages and content
 * - Person: For user profiles and author information
 * - Organization: For groups and communities
 * - WebPage: For general pages and navigation
 * - CollectionPage: For user profiles and group pages
 *
 * Schema.org Benefits:
 * - Enhanced search result appearance with rich snippets
 * - Better search engine understanding of content structure
 * - Improved click-through rates from search results
 * - Support for voice search and AI assistants
 *
 * Implementation Features:
 * - Comprehensive schema markup for all content types
 * - Proper linking between related entities
 * - Publisher and organization information
 * - Breadcrumb navigation support
 * - Image and media optimization
 *
 * Usage Examples:
 * ```javascript
 * // Generate article schema
 * const articleSchema = generateSchemaMarkup('article', {
 *   title: 'Article Title',
 *   description: 'Article description',
 *   url: 'https://wewrite.app/article',
 *   authorName: 'Author Name',
 *   datePublished: '2024-01-01',
 *   dateModified: '2024-01-02'
 * });
 *
 * // Generate person schema
 * const personSchema = generateSchemaMarkup('person', {
 *   name: 'User Name',
 *   url: 'https://wewrite.app/user/username',
 *   description: 'User bio'
 * });
 * ```
 *
 * @param {string} type - The type of content (article, person, group, webpage, collection)
 * @param {object} data - The data to use for the schema markup
 * @returns {object} - The schema markup object
 */
export function generateSchemaMarkup(type, data) {
  switch (type) {
    case 'article':
      return generateArticleSchema(data);
    case 'person':
      return generatePersonSchema(data);
    case 'group':
      return generateGroupSchema(data);
    case 'webpage':
      return generateWebPageSchema(data);
    case 'collection':
      return generateCollectionPageSchema(data);
    default:
      return null;
  }
}

/**
 * Generates schema.org markup for an article
 * 
 * @param {object} data - The article data
 * @returns {object} - The schema markup object
 */
function generateArticleSchema(data) {
  const {
    title,
    description,
    url,
    imageUrl,
    datePublished,
    dateModified,
    authorName,
    authorUrl,
    publisherName,
    publisherLogo,
    publisherUrl
  } = data;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: description || '',
    image: imageUrl || '',
    datePublished: datePublished || new Date().toISOString(),
    dateModified: dateModified || new Date().toISOString(),
    author: {
      '@type': 'Person',
      name: authorName || 'Anonymous',
      url: authorUrl || ''
    },
    publisher: {
      '@type': 'Organization',
      name: publisherName || 'WeWrite',
      logo: {
        '@type': 'ImageObject',
        url: publisherLogo || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.getwewrite.app'}/images/og-image.png`
      },
      url: publisherUrl || (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.getwewrite.app')
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url
    }
  };
}

/**
 * Generates schema.org markup for a person
 * 
 * @param {object} data - The person data
 * @returns {object} - The schema markup object
 */
function generatePersonSchema(data) {
  const {
    name,
    username,
    description,
    url,
    imageUrl
  } = data;

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: name || username || 'Anonymous',
    description: description || '',
    url: url || '',
    image: imageUrl || ''
  };
}

// Groups functionality removed

/**
 * Generates schema.org markup for a WebPage
 *
 * @param {object} data - The webpage data
 * @returns {object} - The schema markup object
 */
function generateWebPageSchema(data) {
  const {
    title,
    description,
    url,
    datePublished,
    dateModified,
    authorName,
    authorUrl,
    breadcrumbs
  } = data;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: description || '',
    url: url,
    datePublished: datePublished || new Date().toISOString(),
    dateModified: dateModified || new Date().toISOString(),
    author: authorName ? {
      '@type': 'Person',
      name: authorName,
      url: authorUrl || ''
    } : undefined,
    breadcrumb: breadcrumbs ? {
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs
    } : undefined,
    isPartOf: {
      '@type': 'WebSite',
      name: 'WeWrite',
      url: process.env.NEXT_PUBLIC_BASE_URL || 'https://www.getwewrite.app'
    }
  };
}

/**
 * Generates schema.org markup for a CollectionPage (like user profiles or group pages)
 *
 * @param {object} data - The collection page data
 * @returns {object} - The schema markup object
 */
function generateCollectionPageSchema(data) {
  const {
    title,
    description,
    url,
    mainEntity,
    numberOfItems
  } = data;

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description: description || '',
    url: url,
    mainEntity: mainEntity,
    numberOfItems: numberOfItems || 0,
    isPartOf: {
      '@type': 'WebSite',
      name: 'WeWrite',
      url: process.env.NEXT_PUBLIC_BASE_URL || 'https://www.getwewrite.app'
    }
  };
}

/**
 * Extracts a description from content
 * 
 * @param {Array|string} content - The content to extract a description from
 * @param {number} maxLength - The maximum length of the description
 * @returns {string} - The extracted description
 */
export function extractDescription(content, maxLength = 160) {
  if (!content) return '';
  
  // If content is a string, return it directly (truncated)
  if (typeof content === 'string') {
    return content.substring(0, maxLength);
  }
  
  // If content is an array (Slate format), extract text from the first paragraph
  if (Array.isArray(content)) {
    try {
      // Find the first paragraph with text
      for (const node of content) {
        if (node.type === 'paragraph' && node.children && node.children.length > 0) {
          // Extract text from all children
          const text = node.children
            .map(child => child.text || '')
            .join('')
            .trim();
          
          if (text) {
            return text.substring(0, maxLength);
          }
        }
      }
    } catch (error) {
      console.error('Error extracting description from content:', error);
    }
  }
  
  return '';
}