/**
 * Competitor Comparison Pages Configuration
 *
 * Defines comparison landing pages for SEO targeting "X vs Y" searches
 */

export interface CompetitorComparison {
  slug: string;
  name: string;
  // SEO
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  // Page Content
  heroTitle: string;
  heroSubtitle: string;
  // Comparison points
  comparisonPoints: {
    feature: string;
    wewrite: string;
    competitor: string;
    wewriteWins: boolean;
  }[];
  // Key advantages
  advantages: {
    title: string;
    description: string;
  }[];
  // Who should switch
  idealFor: string[];
}

export const COMPETITOR_COMPARISONS: Record<string, CompetitorComparison> = {
  medium: {
    slug: 'medium',
    name: 'Medium',
    metaTitle: 'WeWrite vs Medium - Compare Writing Platforms (2025)',
    metaDescription: 'Compare WeWrite and Medium. See why writers are switching from Medium to WeWrite for direct reader support, no paywall limitations, and lower fees.',
    keywords: [
      'WeWrite vs Medium', 'Medium alternative', 'better than Medium',
      'Medium competitor', 'Medium paywall alternative', 'leave Medium',
      'Medium fees', 'Medium alternative 2025', 'writing platform comparison',
      'Medium replacement', 'switch from Medium',
    ],
    heroTitle: 'WeWrite vs Medium',
    heroSubtitle: 'Tired of Medium\'s paywall limiting your reach? Compare the platforms and see why writers are making the switch.',
    comparisonPoints: [
      {
        feature: 'Reader Access',
        wewrite: 'All content freely accessible, readers support voluntarily',
        competitor: 'Paywall limits free articles, pressures readers to subscribe',
        wewriteWins: true,
      },
      {
        feature: 'Monetization Model',
        wewrite: 'Direct reader support - readers pay you',
        competitor: 'Share of subscription pool based on read time',
        wewriteWins: true,
      },
      {
        feature: 'Algorithm Dependence',
        wewrite: 'No algorithm - your content, your audience',
        competitor: 'Algorithm determines visibility and earnings',
        wewriteWins: true,
      },
      {
        feature: 'Content Ownership',
        wewrite: 'You own your content completely',
        competitor: 'Platform controls distribution',
        wewriteWins: true,
      },
      {
        feature: 'Publishing Restrictions',
        wewrite: 'Publish anything (within legal limits)',
        competitor: 'Content curation and editorial policies',
        wewriteWins: true,
      },
    ],
    advantages: [
      {
        title: 'No Paywall Barriers',
        description: 'Your content reaches everyone, not just paying subscribers. Readers support you because they want to, not because they have to.',
      },
      {
        title: 'Direct Earnings',
        description: 'Every dollar a reader gives goes to you (minus minimal processing). No complex pool-sharing formulas.',
      },
      {
        title: 'Algorithm-Free',
        description: 'Your success depends on your content and audience, not on gaming the recommendation algorithm.',
      },
      {
        title: 'True Ownership',
        description: 'Your content, your audience, your terms. No platform lock-in.',
      },
    ],
    idealFor: [
      'Writers frustrated with paywall limitations',
      'Creators tired of algorithm dependence',
      'Authors wanting direct reader relationships',
      'Writers seeking transparent monetization',
    ],
  },

  substack: {
    slug: 'substack',
    name: 'Substack',
    metaTitle: 'WeWrite vs Substack - Compare Newsletter Platforms (2025)',
    metaDescription: 'Compare WeWrite and Substack. Lower fees, flexible monetization, and web-native publishing. See why newsletter creators are exploring alternatives.',
    keywords: [
      'WeWrite vs Substack', 'Substack alternative', 'better than Substack',
      'Substack competitor', 'Substack fees too high', 'leave Substack',
      'Substack alternative 2025', 'newsletter platform comparison',
      'lower fee newsletter', 'Substack replacement',
    ],
    heroTitle: 'WeWrite vs Substack',
    heroSubtitle: 'Compare the platforms. WeWrite offers lower fees and flexible monetization without the 10%+ cut.',
    comparisonPoints: [
      {
        feature: 'Platform Fee',
        wewrite: 'Lower platform fees',
        competitor: '10% of subscription revenue',
        wewriteWins: true,
      },
      {
        feature: 'Monetization Options',
        wewrite: 'Tips, one-time support, flexible amounts',
        competitor: 'Primarily subscription-based',
        wewriteWins: true,
      },
      {
        feature: 'Content Format',
        wewrite: 'Web-native with rich features',
        competitor: 'Email-first newsletter format',
        wewriteWins: true,
      },
      {
        feature: 'Discovery',
        wewrite: 'SEO-friendly, web discoverable',
        competitor: 'Limited to email subscribers',
        wewriteWins: true,
      },
      {
        feature: 'Community Features',
        wewrite: 'Comments, linking, collaboration',
        competitor: 'Basic discussion threads',
        wewriteWins: true,
      },
    ],
    advantages: [
      {
        title: 'Lower Fees',
        description: 'Keep more of what you earn. No 10% platform cut eating into your revenue.',
      },
      {
        title: 'Flexible Support',
        description: 'Let readers support you how they want - tips, one-time gifts, or ongoing support.',
      },
      {
        title: 'Web Presence',
        description: 'Your content lives on the web, discoverable by search engines, not locked in email inboxes.',
      },
      {
        title: 'Rich Features',
        description: 'Collaborative editing, linking, and community features built for the web.',
      },
    ],
    idealFor: [
      'Newsletter writers paying high fees',
      'Creators wanting flexible monetization',
      'Writers seeking better web presence',
      'Newsletter creators wanting lower cuts',
    ],
  },

  ghost: {
    slug: 'ghost',
    name: 'Ghost',
    metaTitle: 'WeWrite vs Ghost - Compare Publishing Platforms (2025)',
    metaDescription: 'Compare WeWrite and Ghost. No hosting required, no technical setup, instant publishing with built-in monetization.',
    keywords: [
      'WeWrite vs Ghost', 'Ghost alternative', 'Ghost competitor',
      'Ghost CMS alternative', 'simpler than Ghost', 'no hosting publishing',
      'Ghost alternative 2025', 'publishing platform comparison',
      'hosted writing platform', 'Ghost replacement',
    ],
    heroTitle: 'WeWrite vs Ghost',
    heroSubtitle: 'All the publishing power without the hosting headaches. Compare the platforms.',
    comparisonPoints: [
      {
        feature: 'Setup Required',
        wewrite: 'Zero setup - start writing immediately',
        competitor: 'Requires hosting, configuration, or Ghost Pro subscription',
        wewriteWins: true,
      },
      {
        feature: 'Technical Knowledge',
        wewrite: 'No technical skills needed',
        competitor: 'Some technical knowledge helpful',
        wewriteWins: true,
      },
      {
        feature: 'Hosting',
        wewrite: 'Fully hosted, no maintenance',
        competitor: 'Self-host or pay for Ghost Pro',
        wewriteWins: true,
      },
      {
        feature: 'Built-in Monetization',
        wewrite: 'Reader support built in',
        competitor: 'Requires Stripe integration setup',
        wewriteWins: true,
      },
      {
        feature: 'Community',
        wewrite: 'Built-in reader community',
        competitor: 'Standalone publishing',
        wewriteWins: true,
      },
    ],
    advantages: [
      {
        title: 'Zero Setup',
        description: 'Start writing in seconds. No hosting to configure, no technical hurdles.',
      },
      {
        title: 'Fully Managed',
        description: 'We handle all the technical stuff. You focus on writing.',
      },
      {
        title: 'Built-in Monetization',
        description: 'Reader support works out of the box. No Stripe integration required.',
      },
      {
        title: 'Community Features',
        description: 'Discover and connect with readers and other writers.',
      },
    ],
    idealFor: [
      'Writers who don\'t want technical hassle',
      'Creators seeking simpler solutions',
      'Non-technical publishers',
      'Writers who want to focus on writing',
    ],
  },

  wordpress: {
    slug: 'wordpress',
    name: 'WordPress',
    metaTitle: 'WeWrite vs WordPress - Compare Blogging Platforms (2025)',
    metaDescription: 'Compare WeWrite and WordPress. No plugins, no maintenance, no security updates. Just write and earn.',
    keywords: [
      'WeWrite vs WordPress', 'WordPress alternative', 'WordPress competitor',
      'simpler than WordPress', 'WordPress alternative for writers',
      'no plugin blogging', 'WordPress alternative 2025', 'blog platform comparison',
      'managed WordPress alternative', 'WordPress replacement for bloggers',
    ],
    heroTitle: 'WeWrite vs WordPress',
    heroSubtitle: 'All the publishing power of WordPress, none of the plugin nightmares. Compare the platforms.',
    comparisonPoints: [
      {
        feature: 'Maintenance',
        wewrite: 'Zero maintenance required',
        competitor: 'Regular updates, security patches, plugin management',
        wewriteWins: true,
      },
      {
        feature: 'Security',
        wewrite: 'Managed security, always protected',
        competitor: 'Your responsibility to secure',
        wewriteWins: true,
      },
      {
        feature: 'Monetization',
        wewrite: 'Built-in reader support',
        competitor: 'Requires plugins and integrations',
        wewriteWins: true,
      },
      {
        feature: 'Speed',
        wewrite: 'Optimized and fast by default',
        competitor: 'Depends on hosting, plugins, optimization',
        wewriteWins: true,
      },
      {
        feature: 'Complexity',
        wewrite: 'Simple, focused on writing',
        competitor: 'Complex, steep learning curve',
        wewriteWins: true,
      },
    ],
    advantages: [
      {
        title: 'No Maintenance',
        description: 'No updates to install, no plugins to manage, no security patches to apply.',
      },
      {
        title: 'Always Secure',
        description: 'We handle security so you don\'t have to worry about vulnerabilities.',
      },
      {
        title: 'Built-in Monetization',
        description: 'Start earning from day one. No plugin configuration required.',
      },
      {
        title: 'Focus on Writing',
        description: 'A clean, distraction-free writing experience designed for writers.',
      },
    ],
    idealFor: [
      'Bloggers tired of WordPress maintenance',
      'Writers who want simplicity',
      'Creators frustrated with plugin issues',
      'Non-technical bloggers',
    ],
  },

  patreon: {
    slug: 'patreon',
    name: 'Patreon',
    metaTitle: 'WeWrite vs Patreon - Compare Creator Platforms (2025)',
    metaDescription: 'Compare WeWrite and Patreon for written content. Purpose-built for writers with better discoverability and flexible support options.',
    keywords: [
      'WeWrite vs Patreon', 'Patreon alternative', 'Patreon for writers',
      'Patreon competitor', 'writer Patreon alternative', 'leave Patreon',
      'Patreon alternative 2025', 'creator platform comparison',
      'Patreon fees', 'Patreon replacement for writers',
    ],
    heroTitle: 'WeWrite vs Patreon',
    heroSubtitle: 'Purpose-built for writers. Compare the platforms and see the difference.',
    comparisonPoints: [
      {
        feature: 'Content Focus',
        wewrite: 'Purpose-built for written content',
        competitor: 'General creator platform (video, audio, etc.)',
        wewriteWins: true,
      },
      {
        feature: 'Discoverability',
        wewrite: 'SEO-friendly, publicly discoverable',
        competitor: 'Content behind login wall',
        wewriteWins: true,
      },
      {
        feature: 'Support Options',
        wewrite: 'Flexible tips and one-time support',
        competitor: 'Primarily tier-based subscriptions',
        wewriteWins: true,
      },
      {
        feature: 'Reader Experience',
        wewrite: 'Clean reading experience on web',
        competitor: 'App/platform focused',
        wewriteWins: true,
      },
      {
        feature: 'Writing Tools',
        wewrite: 'Rich editor with collaboration',
        competitor: 'Basic post creation',
        wewriteWins: true,
      },
    ],
    advantages: [
      {
        title: 'Built for Writers',
        description: 'Every feature designed for written content, not retrofitted from video/audio.',
      },
      {
        title: 'Public by Default',
        description: 'Your content is discoverable by search engines and shareable everywhere.',
      },
      {
        title: 'Flexible Monetization',
        description: 'Readers support how they want - no rigid tier requirements.',
      },
      {
        title: 'Better Reading Experience',
        description: 'Clean, web-native reading experience designed for long-form content.',
      },
    ],
    idealFor: [
      'Writers using Patreon for text content',
      'Authors wanting better discoverability',
      'Creators seeking flexible support options',
      'Writers wanting purpose-built tools',
    ],
  },
};

/**
 * Get all competitor slugs for static page generation
 */
export function getCompetitorSlugs(): string[] {
  return Object.keys(COMPETITOR_COMPARISONS);
}

/**
 * Get a competitor comparison by slug
 */
export function getCompetitorComparison(slug: string): CompetitorComparison | undefined {
  return COMPETITOR_COMPARISONS[slug];
}

/**
 * Check if a slug is a valid competitor
 */
export function isValidCompetitor(slug: string): boolean {
  return slug in COMPETITOR_COMPARISONS;
}

/**
 * Get all competitor comparisons
 */
export function getAllCompetitorComparisons(): CompetitorComparison[] {
  return Object.values(COMPETITOR_COMPARISONS);
}
