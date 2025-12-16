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
  // SEO metadata
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

/**
 * Available landing page verticals
 *
 * Note: Vertical names should focus on the person/audience, not the topic.
 * E.g., "Journalists" not "Journalism", "Homeschooling Parents" not "Homeschool"
 */
export const LANDING_VERTICALS: Record<string, LandingVertical> = {
  general: {
    slug: 'general',
    name: 'General',
    heroTitle: 'Write, share, earn.',
    heroSubtitle: 'WeWrite is a free speech social writing app where every page is a fundraiser.',
    metaTitle: 'WeWrite - Write, Share, Earn | Free Speech Writing Platform',
    metaDescription: 'Join WeWrite, the free speech social writing platform where every page is a fundraiser. Write about anything, build your audience, and earn money directly from readers who value your content.',
    keywords: ['writing platform', 'earn money writing', 'free speech', 'social writing', 'content monetization', 'writer community'],
  },
  writers: {
    slug: 'writers',
    name: 'Writers',
    heroTitle: 'Turn your stories into income.',
    heroSubtitle: 'Stop chasing algorithm tricks. On WeWrite, readers pay you directly for your fiction, essays, and creative writing. Build a real audience that values your craft.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Writers - Earn Money from Your Creative Writing',
    metaDescription: 'Turn your fiction, essays, and creative writing into income on WeWrite. No algorithm tricks—readers pay you directly for your stories. Build a real audience that values your craft.',
    keywords: ['creative writing platform', 'fiction writing', 'earn from writing', 'writer income', 'essay platform', 'publish stories online', 'writing community'],
  },
  journalists: {
    slug: 'journalists',
    name: 'Journalists',
    heroTitle: 'Report the truth. Get paid by readers.',
    heroSubtitle: 'No corporate sponsors. No editorial pressure. Your investigative reporting and analysis is funded directly by readers who want the truth, not advertisers who want influence.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Journalists - Independent Journalism Funded by Readers',
    metaDescription: 'Publish independent journalism without corporate sponsors or editorial pressure. Get funded directly by readers who want truth, not advertisers who want influence.',
    keywords: ['independent journalism', 'reader-funded journalism', 'investigative reporting', 'journalism platform', 'press freedom', 'citizen journalism'],
  },
  homeschoolers: {
    slug: 'homeschoolers',
    name: 'Homeschooling Parents',
    heroTitle: 'Your curriculum. Your community. Your income.',
    heroSubtitle: 'Share the lesson plans, unit studies, and educational materials you\'ve created. Help other homeschool families while earning money for resources that took you hours to develop.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Homeschoolers - Share & Monetize Your Curriculum',
    metaDescription: 'Share your homeschool lesson plans, unit studies, and educational materials with other families. Earn money from the curriculum resources you spent hours creating.',
    keywords: ['homeschool curriculum', 'lesson plans', 'homeschool resources', 'unit studies', 'homeschool community', 'educational materials', 'homeschool parents'],
  },
  debaters: {
    slug: 'debaters',
    name: 'Political Debaters',
    heroTitle: 'Speak your mind. Own your platform.',
    heroSubtitle: 'No shadow bans. No content moderation surprises. Share your political commentary, analysis, and opinions on a free speech platform where your audience—not advertisers—funds your voice.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Political Commentary - Free Speech Platform',
    metaDescription: 'Share political commentary and analysis on a free speech platform. No shadow bans, no moderation surprises. Your audience funds your voice, not advertisers.',
    keywords: ['political commentary', 'free speech platform', 'political analysis', 'opinion writing', 'political debate', 'independent media'],
  },
  researchers: {
    slug: 'researchers',
    name: 'Researchers',
    heroTitle: 'Share research. Bypass the paywall.',
    heroSubtitle: 'Publish your academic papers, data analysis, and findings directly to the public. Get funded by curious minds who want access to knowledge, not locked behind institutional barriers.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Researchers - Publish & Monetize Your Research',
    metaDescription: 'Bypass academic paywalls and publish your research directly to the public. Get funded by curious minds who want access to knowledge, not institutional gatekeepers.',
    keywords: ['academic publishing', 'research platform', 'open access', 'data analysis', 'scientific writing', 'academic papers', 'research funding'],
  },
  'film-critics': {
    slug: 'film-critics',
    name: 'Film Critics',
    heroTitle: 'Your reviews. Your voice. Your earnings.',
    heroSubtitle: 'Write honest movie reviews without studio pressure. Build a loyal audience of film lovers who value your perspective and support your independent criticism.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Film Critics - Independent Movie Reviews That Pay',
    metaDescription: 'Write honest movie reviews without studio pressure. Build a loyal audience of film lovers who support your independent criticism and pay for authentic perspectives.',
    keywords: ['movie reviews', 'film criticism', 'independent film critic', 'movie analysis', 'cinema reviews', 'film writing'],
  },
  'food-critics': {
    slug: 'food-critics',
    name: 'Food Critics',
    heroTitle: 'Review restaurants. Get paid for your taste.',
    heroSubtitle: 'Share authentic dining experiences without advertiser influence. Your readers fund your honest reviews—no comped meals, no conflicts of interest.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Food Critics - Honest Restaurant Reviews That Pay',
    metaDescription: 'Share authentic restaurant reviews without advertiser influence. Your readers fund honest dining critiques—no comped meals, no conflicts of interest.',
    keywords: ['restaurant reviews', 'food criticism', 'dining reviews', 'food writing', 'culinary reviews', 'independent food critic'],
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
