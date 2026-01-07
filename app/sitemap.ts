/**
 * WeWrite SEO Implementation - Main Sitemap Generator
 *
 * This file generates the main XML sitemap for WeWrite's static pages and navigation.
 * Part of the comprehensive SEO optimization system that includes:
 *
 * Sitemap Structure:
 * - Main Sitemap (/sitemap.xml): Static pages and navigation (this file)
 * - Pages Sitemap (/sitemap-pages.xml): All public user pages
 * - Users Sitemap (/sitemap-users.xml): Active user profiles
 * - Groups Sitemap (/sitemap-groups.xml): Public groups
 *
 * SEO Benefits:
 * - Helps search engines discover and index content efficiently
 * - Provides priority and update frequency hints
 * - Supports large-scale content indexing
 * - Improves crawl budget optimization
 *
 * Priority Guidelines:
 * - Homepage: 1.0 (highest priority)
 * - Main navigation: 0.8-0.9 (high priority)
 * - Feature pages: 0.6-0.7 (medium-high priority)
 * - Static pages: 0.3-0.5 (medium priority)
 *
 * Update Frequencies:
 * - Homepage: daily (dynamic content)
 * - Trending/Leaderboard: hourly/daily (frequently updated)
 * - Static pages: monthly (rarely updated)
 * - Legal pages: monthly (infrequent updates)
 *
 * The sitemap is automatically generated and submitted to search engines
 * for optimal content discovery and indexing.
 */

import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  // Use www.getwewrite.app as the canonical domain
  const baseUrl = 'https://www.getwewrite.app'

  return [
    // Homepage - highest priority
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1},

    // Main navigation pages - high priority
    {
      url: `${baseUrl}/trending`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9},
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8},
    {
      url: `${baseUrl}/groups`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8},
    {
      url: `${baseUrl}/users`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},

    // Note: /search and /activity are excluded from sitemap because
    // they are disallowed in robots.txt (dynamic content, requires auth)

    // Authentication pages
    {
      url: `${baseUrl}/auth/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5},
    {
      url: `${baseUrl}/auth/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5},

    // Featured and topic pages - SEO landing pages
    {
      url: `${baseUrl}/featured`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8},
    {
      url: `${baseUrl}/topics`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8},
    // Individual topic pages
    {
      url: `${baseUrl}/topics/technology`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},
    {
      url: `${baseUrl}/topics/writing`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},
    {
      url: `${baseUrl}/topics/creativity`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},
    {
      url: `${baseUrl}/topics/business`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},
    {
      url: `${baseUrl}/topics/personal`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},
    {
      url: `${baseUrl}/topics/tutorial`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},
    {
      url: `${baseUrl}/topics/programming`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},
    {
      url: `${baseUrl}/topics/design`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},
    {
      url: `${baseUrl}/topics/science`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},
    {
      url: `${baseUrl}/topics/philosophy`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7},

    // Feature and help pages
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6},
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5},
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.4},
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3},
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3},

    // Note: Content creation pages (/new, /group/new) are excluded from sitemap
    // as they require authentication and shouldn't be indexed.
    // User-created content pages are indexed via /api/sitemap-pages which
    // dynamically queries all public pages from the database.
  ]
}