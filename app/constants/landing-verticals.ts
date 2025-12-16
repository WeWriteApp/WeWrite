/**
 * Landing Page Verticals Configuration
 *
 * Defines vertical-specific hero content for targeted landing pages.
 * Each vertical has custom messaging designed for that audience.
 */

export interface LandingVertical {
  slug: string;
  name: string;
  heroTitle: string;
  heroSubtitle: string;
  statsPrefix?: string; // Optional custom prefix for the stats line
}

/**
 * Available landing page verticals
 */
export const LANDING_VERTICALS: Record<string, LandingVertical> = {
  general: {
    slug: 'general',
    name: 'General',
    heroTitle: 'Write, share, earn.',
    heroSubtitle: 'WeWrite is a free speech social writing app where every page is a fundraiser.',
  },
  writers: {
    slug: 'writers',
    name: 'Writers',
    heroTitle: 'Turn your stories into income.',
    heroSubtitle: 'Stop chasing algorithm tricks. On WeWrite, readers pay you directly for your fiction, essays, and creative writing. Build a real audience that values your craft.',
    statsPrefix: 'Join',
  },
  journalism: {
    slug: 'journalism',
    name: 'Journalism',
    heroTitle: 'Report the truth. Get paid by readers.',
    heroSubtitle: 'No corporate sponsors. No editorial pressure. Your investigative reporting and analysis is funded directly by readers who want the truth, not advertisers who want influence.',
    statsPrefix: 'Join',
  },
  homeschool: {
    slug: 'homeschool',
    name: 'Homeschool',
    heroTitle: 'Your curriculum. Your community. Your income.',
    heroSubtitle: 'Share the lesson plans, unit studies, and educational materials you\'ve created. Help other homeschool families while earning money for resources that took you hours to develop.',
    statsPrefix: 'Join',
  },
  politics: {
    slug: 'politics',
    name: 'Politics',
    heroTitle: 'Speak your mind. Own your platform.',
    heroSubtitle: 'No shadow bans. No content moderation surprises. Share your political commentary, analysis, and opinions on a free speech platform where your audience—not advertisers—funds your voice.',
    statsPrefix: 'Join',
  },
  research: {
    slug: 'research',
    name: 'Research',
    heroTitle: 'Share research. Bypass the paywall.',
    heroSubtitle: 'Publish your academic papers, data analysis, and findings directly to the public. Get funded by curious minds who want access to knowledge, not locked behind institutional barriers.',
    statsPrefix: 'Join',
  },
};

/**
 * Get all vertical slugs for static page generation
 */
export function getVerticalSlugs(): string[] {
  return Object.keys(LANDING_VERTICALS).filter(slug => slug !== 'general');
}

/**
 * Get a vertical by slug, with fallback to general
 */
export function getVertical(slug: string): LandingVertical {
  return LANDING_VERTICALS[slug] || LANDING_VERTICALS.general;
}

/**
 * Check if a slug is a valid vertical
 */
export function isValidVertical(slug: string): boolean {
  return slug in LANDING_VERTICALS;
}
