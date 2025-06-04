"use client";

/**
 * Generates schema.org markup for different content types
 * 
 * @param {string} type - The type of content (article, person, group)
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
        url: publisherLogo || 'https://wewrite.app/logo.png'
      },
      url: publisherUrl || 'https://wewrite.app'
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

/**
 * Generates schema.org markup for a group
 *
 * @param {object} data - The group data
 * @returns {object} - The schema markup object
 */
function generateGroupSchema(data) {
  const {
    name,
    description,
    url,
    imageUrl,
    memberCount,
    createdAt,
    createdBy
  } = data;

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: name || 'Unnamed Group',
    description: description || '',
    url: url || '',
    logo: imageUrl ? {
      '@type': 'ImageObject',
      url: imageUrl
    } : undefined,
    numberOfEmployees: memberCount || 0,
    foundingDate: createdAt || undefined,
    founder: createdBy ? {
      '@type': 'Person',
      name: createdBy
    } : undefined,
    sameAs: url ? [url] : undefined
  };
}

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
      url: 'https://wewrite.app'
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
      url: 'https://wewrite.app'
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
