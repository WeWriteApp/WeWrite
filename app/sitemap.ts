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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getwewrite.app'

  return [
    // Homepage - highest priority
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },

    // Main navigation pages - high priority
    {
      url: `${baseUrl}/trending`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/groups`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/users`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },

    // Search and discovery pages
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/activity`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.7,
    },

    // Authentication pages
    {
      url: `${baseUrl}/auth/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/auth/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },

    // Feature and help pages
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },

    // Content creation pages
    {
      url: `${baseUrl}/new`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/group/new`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },

    // Popular feature pages (from landing page)
    {
      url: `${baseUrl}/page/RFsPq1tbcOMtljwHyIMT`, // Every Page is a Fundraiser
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/page/aJFMqTEKuNEHvOrYE9c2`, // No ads
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/page/ou1LPmpynpoirLrv99fq`, // Multiple view modes
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/page/o71h6Lg1wjGSC1pYaKXz`, // Recurring donations
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/page/4jw8FdMJHGofMc4G2QTw`, // Collaborative pages
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/page/N7Pg3iJ0OQhkpw16MTZW`, // Map view
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/page/0krXqAU748w43YnWJwE2`, // Calendar view
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/zRNwhNgIEfLFo050nyAT`, // Feature roadmap page
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    }
  ]
}
