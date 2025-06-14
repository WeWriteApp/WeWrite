"use client";

/**
 * WeWrite SEO Implementation - SEO Utility Functions
 *
 * This module provides comprehensive SEO utility functions for WeWrite's
 * user-generated content platform to optimize search engine visibility.
 *
 * Key Functions:
 * - extractDescription(): Clean description extraction from Slate content
 * - generateKeywords(): Intelligent keyword generation from content and metadata
 * - generateSlug(): URL-friendly slug generation from text
 * - extractWordsFromText(): Meaningful word extraction with stop word filtering
 *
 * SEO Best Practices Implemented:
 * - Titles: Descriptive, unique titles (50-60 characters)
 * - Descriptions: Compelling meta descriptions (150-160 characters)
 * - Keywords: Relevant keyword extraction from content and context
 * - URLs: Clean, descriptive URL slug generation
 *
 * Content Optimization Features:
 * - Automatic description generation from page content
 * - Context-aware keyword extraction (title, content, tags, author, group)
 * - Stop word filtering for meaningful keyword extraction
 * - Default WeWrite keywords for brand consistency
 *
 * Usage Examples:
 * ```typescript
 * // Extract description from content
 * const description = extractDescription(pageContent, 160);
 *
 * // Generate keywords from page data
 * const keywords = generateKeywords({
 *   title: 'Page Title',
 *   content: 'Page content...',
 *   tags: ['tag1', 'tag2'],
 *   username: 'author',
 *   groupName: 'group'
 * });
 *
 * // Create URL slug
 * const slug = generateSlug('My Page Title');
 * ```
 */

import { extractTextContent as extractDescriptionFromText } from './text-extraction';

/** Options for keyword generation */
interface KeywordOptions {
  /** Page title */
  title?: string;
  /** Page content */
  content?: string;
  /** Existing tags */
  tags?: string[];
  /** Author username */
  username?: string;
  /** Group name if applicable */
  groupName?: string;
}

/** Breadcrumb item */
interface BreadcrumbItem {
  /** Display name */
  name: string;
  /** URL */
  url: string;
}

/** Options for breadcrumb generation */
interface BreadcrumbOptions {
  /** Current page title */
  pageTitle?: string;
  /** Current page URL */
  pageUrl?: string;
  /** Author username */
  username?: string;
  /** Author URL */
  userUrl?: string;
  /** Group name */
  groupName?: string;
  /** Group URL */
  groupUrl?: string;
}

/**
 * Extracts a clean description from Slate content
 */
export function extractDescription(content: any, maxLength: number = 160): string {
  return extractDescriptionFromText(content, maxLength);
}

/**
 * Generates keywords from content and metadata
 */
export function generateKeywords({
  title = '',
  content = '',
  tags = [],
  username = '',
  groupName = ''
}: KeywordOptions): string[] {
  const keywords = new Set();
  
  // Add existing tags
  tags.forEach(tag => {
    if (tag && typeof tag === 'string') {
      keywords.add(tag.toLowerCase());
    }
  });
  
  // Add username
  if (username) {
    keywords.add(username.toLowerCase());
  }
  
  // Add group name
  if (groupName) {
    keywords.add(groupName.toLowerCase());
  }
  
  // Extract keywords from title
  const titleWords = extractWordsFromText(title);
  titleWords.forEach(word => keywords.add(word));
  
  // Extract keywords from content (first 500 characters)
  const contentText = extractDescription(content, 500);
  const contentWords = extractWordsFromText(contentText);
  contentWords.slice(0, 10).forEach(word => keywords.add(word)); // Limit content keywords
  
  // Add default WeWrite keywords
  const defaultKeywords = ['wewrite', 'collaboration', 'writing', 'social wiki'];
  defaultKeywords.forEach(keyword => keywords.add(keyword));
  
  return Array.from(keywords).filter(keyword => keyword.length > 2);
}

/**
 * Extracts meaningful words from text
 */
function extractWordsFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  // Common stop words to exclude
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
    'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 20); // Limit to 20 words
}

/**
 * Generates a clean URL slug from text
 */
export function generateSlug(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Validates and cleans meta description
 */
export function cleanMetaDescription(description: string): string {
  if (!description || typeof description !== 'string') return '';

  return description
    .replace(/\s+/g, ' ') // Replace multiple spaces
    .replace(/[""]/g, '"') // Normalize quotes
    .replace(/['']/g, "'") // Normalize apostrophes
    .trim()
    .substring(0, 160); // Meta description should be under 160 characters
}

/**
 * Generates breadcrumbs for a page
 */
export function generateBreadcrumbs({
  pageTitle,
  pageUrl,
  username,
  userUrl,
  groupName,
  groupUrl
}: BreadcrumbOptions): BreadcrumbItem[] {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app';
  const breadcrumbs = [
    {
      name: 'WeWrite',
      url: baseUrl
    }
  ];
  
  if (groupName && groupUrl) {
    breadcrumbs.push({
      name: groupName,
      url: groupUrl
    });
  } else if (username && userUrl) {
    breadcrumbs.push({
      name: username,
      url: userUrl
    });
  }
  
  if (pageTitle && pageUrl) {
    breadcrumbs.push({
      name: pageTitle,
      url: pageUrl
    });
  }
  
  return breadcrumbs;
}
