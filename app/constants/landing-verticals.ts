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
    heroTitle: 'Your words deserve to be valued.',
    heroSubtitle: 'WeWrite is where writers get paid directly by readers. No ads, no algorithms—just your stories and your supporters.',
    statsPrefix: 'Join',
  },
  journalism: {
    slug: 'journalism',
    name: 'Journalism',
    heroTitle: 'Independent journalism, funded by readers.',
    heroSubtitle: 'Report the truth without editorial interference. Your readers fund your work directly—no advertisers to please.',
    statsPrefix: 'Join',
  },
  homeschool: {
    slug: 'homeschool',
    name: 'Homeschool',
    heroTitle: 'Share your homeschool curriculum and get paid.',
    heroSubtitle: 'Create lesson plans, educational content, and teaching resources. Other homeschool families can support your work directly.',
    statsPrefix: 'Join',
  },
  politics: {
    slug: 'politics',
    name: 'Politics',
    heroTitle: 'Political commentary without censorship.',
    heroSubtitle: 'Share your political analysis and opinions freely. WeWrite is a free speech platform where your supporters fund your voice.',
    statsPrefix: 'Join',
  },
  research: {
    slug: 'research',
    name: 'Research',
    heroTitle: 'Publish your research, fund your work.',
    heroSubtitle: 'Share academic papers, studies, and analysis. Get direct support from readers who value independent research.',
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
