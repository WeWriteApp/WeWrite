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
  // ============================================================================
  // ORIGINAL VERTICALS (Enhanced with more keywords)
  // ============================================================================
  general: {
    slug: 'general',
    name: 'General',
    heroTitle: 'Write, share, earn.',
    heroSubtitle: 'WeWrite is a free speech social writing app where every page is a fundraiser.',
    metaTitle: 'WeWrite - Write, Share, Earn | Free Speech Writing Platform',
    metaDescription: 'Join WeWrite, the free speech social writing platform where every page is a fundraiser. Write about anything, build your audience, and earn money directly from readers who value your content.',
    keywords: [
      'writing platform', 'earn money writing', 'free speech', 'social writing',
      'content monetization', 'writer community', 'publish online', 'blog platform',
      'Medium alternative', 'Substack alternative', 'reader-funded publishing',
      'collaborative writing', 'independent publishing', 'tip jar for writers',
      'creator economy', 'get paid to write', 'monetize blog',
    ],
  },
  writers: {
    slug: 'writers',
    name: 'Writers',
    heroTitle: 'Turn your stories into income.',
    heroSubtitle: 'Stop chasing algorithm tricks. On WeWrite, readers pay you directly for your fiction, essays, and creative writing. Build a real audience that values your craft.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Writers - Earn Money from Your Creative Writing',
    metaDescription: 'Turn your fiction, essays, and creative writing into income on WeWrite. No algorithm tricks—readers pay you directly for your stories. Build a real audience that values your craft.',
    keywords: [
      'creative writing platform', 'fiction writing', 'earn from writing', 'writer income',
      'essay platform', 'publish stories online', 'writing community', 'aspiring writer platform',
      'short story publishing', 'poetry platform', 'indie author', 'self-publishing',
      'writer monetization', 'storytelling platform', 'narrative writing', 'literary platform',
      'emerging writers', 'writing portfolio', 'author platform',
    ],
  },
  journalists: {
    slug: 'journalists',
    name: 'Journalists',
    heroTitle: 'Report the truth. Get paid by readers.',
    heroSubtitle: 'No corporate sponsors. No editorial pressure. Your investigative reporting and analysis is funded directly by readers who want the truth, not advertisers who want influence.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Journalists - Independent Journalism Funded by Readers',
    metaDescription: 'Publish independent journalism without corporate sponsors or editorial pressure. Get funded directly by readers who want truth, not advertisers who want influence.',
    keywords: [
      'independent journalism', 'reader-funded journalism', 'investigative reporting',
      'journalism platform', 'press freedom', 'citizen journalism', 'grassroots journalism',
      'community journalism', 'local journalism', 'alternative media', 'news platform',
      'reporter platform', 'journalist monetization', 'uncensored news', 'media independence',
      'journalism crowdfunding', 'subscriber-funded news', 'independent media',
    ],
  },
  homeschoolers: {
    slug: 'homeschoolers',
    name: 'Homeschooling Parents',
    heroTitle: 'Your curriculum. Your community. Your income.',
    heroSubtitle: 'Share the lesson plans, unit studies, and educational materials you\'ve created. Help other homeschool families while earning money for resources that took you hours to develop.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Homeschoolers - Share & Monetize Your Curriculum',
    metaDescription: 'Share your homeschool lesson plans, unit studies, and educational materials with other families. Earn money from the curriculum resources you spent hours creating.',
    keywords: [
      'homeschool curriculum', 'lesson plans', 'homeschool resources', 'unit studies',
      'homeschool community', 'educational materials', 'homeschool parents', 'curriculum sharing',
      'homeschool marketplace', 'teaching resources', 'homeschool co-op', 'educational content',
      'homeschool lesson sharing', 'curriculum monetization', 'homeschool network',
      'parent-created curriculum', 'homeschool support', 'educational blogger',
    ],
  },
  debaters: {
    slug: 'debaters',
    name: 'Political Debaters',
    heroTitle: 'Speak your mind. Own your platform.',
    heroSubtitle: 'No shadow bans. No content moderation surprises. Share your political commentary, analysis, and opinions on a free speech platform where your audience—not advertisers—funds your voice.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Political Commentary - Free Speech Platform',
    metaDescription: 'Share political commentary and analysis on a free speech platform. No shadow bans, no moderation surprises. Your audience funds your voice, not advertisers.',
    keywords: [
      'political commentary', 'free speech platform', 'political analysis', 'opinion writing',
      'political debate', 'independent media', 'political opinion', 'civic discourse',
      'uncensored platform', 'political journalism', 'commentary platform', 'op-ed platform',
      'political writing', 'free expression', 'political blogger', 'policy analysis',
      'current events commentary', 'political pundit platform',
    ],
  },
  researchers: {
    slug: 'researchers',
    name: 'Researchers',
    heroTitle: 'Share research. Bypass the paywall.',
    heroSubtitle: 'Publish your academic papers, data analysis, and findings directly to the public. Get funded by curious minds who want access to knowledge, not locked behind institutional barriers.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Researchers - Publish & Monetize Your Research',
    metaDescription: 'Bypass academic paywalls and publish your research directly to the public. Get funded by curious minds who want access to knowledge, not institutional gatekeepers.',
    keywords: [
      'academic publishing', 'research platform', 'open access', 'data analysis',
      'scientific writing', 'academic papers', 'research funding', 'scholarly communication',
      'preprint platform', 'research dissemination', 'academic blogging', 'science communication',
      'citizen science', 'research monetization', 'academic freedom', 'knowledge sharing',
      'scientific publishing', 'researcher platform',
    ],
  },
  'film-critics': {
    slug: 'film-critics',
    name: 'Film Critics',
    heroTitle: 'Your reviews. Your voice. Your earnings.',
    heroSubtitle: 'Write honest movie reviews without studio pressure. Build a loyal audience of film lovers who value your perspective and support your independent criticism.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Film Critics - Independent Movie Reviews That Pay',
    metaDescription: 'Write honest movie reviews without studio pressure. Build a loyal audience of film lovers who support your independent criticism and pay for authentic perspectives.',
    keywords: [
      'movie reviews', 'film criticism', 'independent film critic', 'movie analysis',
      'cinema reviews', 'film writing', 'movie blogger', 'film commentary',
      'honest reviews', 'unbiased film reviews', 'movie critic platform', 'cinema journalism',
      'film review monetization', 'entertainment criticism', 'movie opinion',
    ],
  },
  'food-critics': {
    slug: 'food-critics',
    name: 'Food Critics',
    heroTitle: 'Review restaurants. Get paid for your taste.',
    heroSubtitle: 'Share authentic dining experiences without advertiser influence. Your readers fund your honest reviews—no comped meals, no conflicts of interest.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Food Critics - Honest Restaurant Reviews That Pay',
    metaDescription: 'Share authentic restaurant reviews without advertiser influence. Your readers fund honest dining critiques—no comped meals, no conflicts of interest.',
    keywords: [
      'restaurant reviews', 'food criticism', 'dining reviews', 'food writing',
      'culinary reviews', 'independent food critic', 'food blogger', 'restaurant critic',
      'honest food reviews', 'culinary journalism', 'food review platform', 'dining guide',
      'food content monetization', 'gastronomic writing', 'chef reviews',
    ],
  },

  // ============================================================================
  // NEW VERTICALS
  // ============================================================================
  teachers: {
    slug: 'teachers',
    name: 'Teachers',
    heroTitle: 'Your lessons deserve to earn.',
    heroSubtitle: 'Share the teaching materials, lesson plans, and classroom resources you\'ve created. Help fellow educators while earning from your expertise and preparation time.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Teachers - Share & Monetize Your Teaching Resources',
    metaDescription: 'Share your lesson plans, teaching materials, and classroom resources with fellow educators. Earn money from the content you spend hours preparing.',
    keywords: [
      'teacher resources', 'lesson plans', 'teaching materials', 'classroom resources',
      'educator platform', 'teacher marketplace', 'educational content', 'teaching community',
      'curriculum sharing', 'teacher monetization', 'K-12 resources', 'teaching tips',
      'educator blog', 'teacher-created content', 'educational blogger',
      'sell teaching materials', 'teacher income', 'tutoring resources',
    ],
  },
  'newsletter-writers': {
    slug: 'newsletter-writers',
    name: 'Newsletter Writers',
    heroTitle: 'Your newsletter. Lower fees. More freedom.',
    heroSubtitle: 'Tired of platform fees eating your earnings? Publish your newsletter on WeWrite with direct reader support and keep more of what you earn.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Newsletter Writers - Substack Alternative with Lower Fees',
    metaDescription: 'Publish your newsletter with lower fees than Substack. Get direct reader support and keep more of your earnings. The newsletter platform that puts writers first.',
    keywords: [
      'newsletter platform', 'Substack alternative', 'email newsletter', 'paid newsletter',
      'newsletter monetization', 'subscriber platform', 'newsletter community',
      'newsletter creator', 'low fee newsletter', 'newsletter earnings', 'email to web',
      'newsletter writer platform', 'subscriber-funded', 'newsletter publishing',
      'build newsletter audience', 'newsletter income',
    ],
  },
  'fiction-writers': {
    slug: 'fiction-writers',
    name: 'Fiction Writers',
    heroTitle: 'Serialize your stories. Build your fanbase.',
    heroSubtitle: 'Publish your novels chapter by chapter, share short stories, or serialize your fiction. Build a dedicated readership that supports your creative journey.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Fiction Writers - Serialize & Monetize Your Stories',
    metaDescription: 'Publish serialized fiction, short stories, and novels on WeWrite. Build a fanbase that supports your creative writing with direct reader funding.',
    keywords: [
      'serialized fiction', 'web novel platform', 'fiction publishing', 'short stories online',
      'creative writing platform', 'story serialization', 'indie fiction', 'novel publishing',
      'fiction monetization', 'story platform', 'web fiction', 'serial novel',
      'chapter publishing', 'fiction community', 'storyteller platform', 'narrative writing',
      'fiction writer income', 'fan-funded fiction',
    ],
  },
  poets: {
    slug: 'poets',
    name: 'Poets',
    heroTitle: 'Your verses. Your value.',
    heroSubtitle: 'Share your poetry with readers who truly appreciate the craft. Build a community of poetry lovers who support your work directly.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Poets - Share & Earn from Your Poetry',
    metaDescription: 'Share your poetry with an audience that values the craft. Build a community of poetry lovers who support your work with direct funding.',
    keywords: [
      'poetry platform', 'publish poetry online', 'poetry community', 'poet monetization',
      'share poems', 'poetry publishing', 'indie poet', 'poetry blog',
      'verse sharing', 'poetry readers', 'contemporary poetry', 'poetry earnings',
      'poet platform', 'poetry portfolio', 'literary poetry', 'spoken word platform',
    ],
  },
  'local-news': {
    slug: 'local-news',
    name: 'Local News Writers',
    heroTitle: 'Cover your community. Get community support.',
    heroSubtitle: 'Report on local issues, events, and stories that matter to your neighborhood. Get funded by community members who value local journalism.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Local News - Community-Funded Local Journalism',
    metaDescription: 'Report on local issues and stories that matter to your community. Get funded directly by neighbors who value local journalism.',
    keywords: [
      'local news', 'community journalism', 'hyperlocal news', 'neighborhood news',
      'local reporting', 'community news platform', 'local journalist', 'city news',
      'town news', 'local events coverage', 'community-funded news', 'grassroots journalism',
      'local news monetization', 'neighborhood reporting', 'regional news',
      'local journalism platform', 'citizen reporter',
    ],
  },
  academics: {
    slug: 'academics',
    name: 'Academics',
    heroTitle: 'Reach beyond the ivory tower.',
    heroSubtitle: 'Share your expertise with a broader audience. Publish accessible versions of your research and get supported by curious minds outside academia.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Academics - Public Scholarship That Pays',
    metaDescription: 'Share your academic expertise with a broader audience. Publish accessible research and get supported by curious minds beyond the ivory tower.',
    keywords: [
      'academic blogging', 'public scholarship', 'professor blog', 'academic writing',
      'research communication', 'public intellectual', 'academic platform', 'scholar blogging',
      'accessible academia', 'expert platform', 'thought leadership', 'academic outreach',
      'public-facing research', 'academic monetization', 'graduate student writing',
      'academic expertise', 'scholarly blog',
    ],
  },
  'how-to-creators': {
    slug: 'how-to-creators',
    name: 'Tutorial Writers',
    heroTitle: 'Teach what you know. Earn what you\'re worth.',
    heroSubtitle: 'Share tutorials, guides, and how-to content. Help others learn while earning from your expertise and teaching ability.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Tutorial Writers - Monetize Your How-To Content',
    metaDescription: 'Share tutorials, guides, and how-to content on WeWrite. Help others learn while earning from your expertise and teaching ability.',
    keywords: [
      'tutorial platform', 'how-to guides', 'instructional content', 'teaching platform',
      'tutorial monetization', 'skill sharing', 'how-to writing', 'guide publishing',
      'educational tutorials', 'step-by-step guides', 'learning content', 'expert tutorials',
      'DIY guides', 'instructional writing', 'tutorial creator', 'knowledge sharing',
      'teach online', 'expertise monetization',
    ],
  },
  reviewers: {
    slug: 'reviewers',
    name: 'Product Reviewers',
    heroTitle: 'Honest reviews. Reader-funded integrity.',
    heroSubtitle: 'Write unbiased product and service reviews without sponsor pressure. Your readers fund your honesty, not companies seeking favorable coverage.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Reviewers - Honest Reviews Funded by Readers',
    metaDescription: 'Write honest product and service reviews without sponsor pressure. Get funded by readers who value unbiased opinions over paid endorsements.',
    keywords: [
      'product reviews', 'honest reviews', 'unbiased reviews', 'review platform',
      'product reviewer', 'service reviews', 'independent reviewer', 'review monetization',
      'consumer reviews', 'tech reviews', 'gadget reviews', 'software reviews',
      'buyer guides', 'comparison reviews', 'honest opinion platform', 'review writer',
    ],
  },
  'sports-writers': {
    slug: 'sports-writers',
    name: 'Sports Writers',
    heroTitle: 'Your analysis. Your fans. Your income.',
    heroSubtitle: 'Share game coverage, player analysis, and sports commentary. Build a fanbase that pays for your insights and predictions.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Sports Writers - Sports Commentary That Pays',
    metaDescription: 'Share sports analysis, game coverage, and commentary on WeWrite. Build a fanbase that supports your sports writing with direct funding.',
    keywords: [
      'sports writing', 'sports commentary', 'game analysis', 'sports journalism',
      'sports blogger', 'sports opinion', 'player analysis', 'team coverage',
      'fantasy sports content', 'sports news', 'athletic coverage', 'sports pundit',
      'sports monetization', 'fan-funded sports', 'sports prediction', 'sports platform',
    ],
  },
  'tech-writers': {
    slug: 'tech-writers',
    name: 'Tech Writers',
    heroTitle: 'Code, explain, earn.',
    heroSubtitle: 'Share programming tutorials, tech reviews, and developer insights. Build an audience of tech enthusiasts who support your content.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Tech Writers - Developer Content That Pays',
    metaDescription: 'Share programming tutorials, tech reviews, and developer insights. Build an audience that supports your tech writing with direct funding.',
    keywords: [
      'tech blogging', 'programming tutorials', 'developer blog', 'tech reviews',
      'software writing', 'coding guides', 'tech journalism', 'developer platform',
      'tech monetization', 'programming content', 'tech community', 'software tutorials',
      'tech writer platform', 'developer content', 'tech tips', 'coding blog',
    ],
  },
  'travel-writers': {
    slug: 'travel-writers',
    name: 'Travel Writers',
    heroTitle: 'Share your journeys. Fund your adventures.',
    heroSubtitle: 'Write destination guides, travel stories, and local insights. Get supported by readers planning their own adventures.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Travel Writers - Travel Content That Pays',
    metaDescription: 'Share destination guides, travel stories, and local insights. Get funded by readers who value authentic travel content over sponsored posts.',
    keywords: [
      'travel writing', 'travel blog', 'destination guides', 'travel stories',
      'travel journalism', 'travel platform', 'travel monetization', 'adventure writing',
      'travel tips', 'local guides', 'travel community', 'travel content',
      'authentic travel', 'travel blogger', 'wanderlust content', 'trip guides',
    ],
  },
  'health-writers': {
    slug: 'health-writers',
    name: 'Health Writers',
    heroTitle: 'Share wellness wisdom. Get supported.',
    heroSubtitle: 'Write about health, fitness, and wellness without advertiser conflicts. Build a community that values evidence-based health content.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Health Writers - Wellness Content That Pays',
    metaDescription: 'Share health, fitness, and wellness content without advertiser pressure. Build a community that supports evidence-based health writing.',
    keywords: [
      'health writing', 'wellness blog', 'fitness content', 'health journalism',
      'medical writing', 'health platform', 'wellness monetization', 'nutrition writing',
      'mental health content', 'health tips', 'wellness community', 'health blogger',
      'fitness writing', 'holistic health', 'health education', 'wellness platform',
    ],
  },
  'finance-writers': {
    slug: 'finance-writers',
    name: 'Finance Writers',
    heroTitle: 'Financial insights. Reader-funded honesty.',
    heroSubtitle: 'Share investment analysis, money tips, and financial education. Get paid by readers, not financial product sponsors.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Finance Writers - Financial Content That Pays',
    metaDescription: 'Share financial insights, investment analysis, and money tips. Get funded by readers who value honest financial content over sponsored advice.',
    keywords: [
      'finance writing', 'investment blog', 'financial content', 'money tips',
      'finance platform', 'financial journalism', 'investing content', 'personal finance',
      'financial education', 'money blog', 'finance monetization', 'economic analysis',
      'financial advice', 'wealth building', 'finance community', 'financial blogger',
    ],
  },
  'parenting-writers': {
    slug: 'parenting-writers',
    name: 'Parenting Writers',
    heroTitle: 'Real parenting stories. Real support.',
    heroSubtitle: 'Share your parenting experiences, advice, and family stories. Connect with other parents who value authentic voices over perfect Instagram lives.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Parenting Writers - Family Content That Pays',
    metaDescription: 'Share authentic parenting experiences and family stories. Build a community of parents who support real voices over sponsored content.',
    keywords: [
      'parenting blog', 'family writing', 'parent platform', 'parenting advice',
      'mom blog', 'dad blog', 'family content', 'parenting stories',
      'parenting monetization', 'family community', 'parent blogger', 'child development',
      'parenting tips', 'family life', 'authentic parenting', 'parent support',
    ],
  },
  'faith-writers': {
    slug: 'faith-writers',
    name: 'Faith Writers',
    heroTitle: 'Share your faith. Build your ministry.',
    heroSubtitle: 'Write about spirituality, faith, and religious topics. Build a community of believers who support your spiritual content.',
    statsPrefix: 'Join',
    metaTitle: 'WeWrite for Faith Writers - Spiritual Content That Pays',
    metaDescription: 'Share your faith, spiritual insights, and religious content. Build a community that supports your ministry through direct reader funding.',
    keywords: [
      'faith writing', 'religious blog', 'spiritual content', 'faith platform',
      'ministry platform', 'Christian writing', 'religious content', 'spiritual blog',
      'faith community', 'devotional writing', 'religious journalism', 'faith monetization',
      'spiritual growth', 'church content', 'religious platform', 'faith blogger',
    ],
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

/**
 * Get all verticals for display (e.g., in navigation)
 */
export function getAllVerticals(): LandingVertical[] {
  return Object.values(LANDING_VERTICALS);
}

/**
 * Get verticals by category for organized display
 */
export function getVerticalsByCategory(): Record<string, LandingVertical[]> {
  return {
    'Content Creators': [
      LANDING_VERTICALS.writers,
      LANDING_VERTICALS['fiction-writers'],
      LANDING_VERTICALS.poets,
      LANDING_VERTICALS['newsletter-writers'],
    ],
    'Journalism & News': [
      LANDING_VERTICALS.journalists,
      LANDING_VERTICALS['local-news'],
      LANDING_VERTICALS.debaters,
    ],
    'Education': [
      LANDING_VERTICALS.teachers,
      LANDING_VERTICALS.homeschoolers,
      LANDING_VERTICALS.academics,
      LANDING_VERTICALS['how-to-creators'],
    ],
    'Critics & Reviewers': [
      LANDING_VERTICALS['film-critics'],
      LANDING_VERTICALS['food-critics'],
      LANDING_VERTICALS.reviewers,
    ],
    'Niche Topics': [
      LANDING_VERTICALS['tech-writers'],
      LANDING_VERTICALS['sports-writers'],
      LANDING_VERTICALS['travel-writers'],
      LANDING_VERTICALS['health-writers'],
      LANDING_VERTICALS['finance-writers'],
    ],
    'Lifestyle & Community': [
      LANDING_VERTICALS['parenting-writers'],
      LANDING_VERTICALS['faith-writers'],
      LANDING_VERTICALS.researchers,
    ],
  };
}
