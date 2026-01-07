/**
 * Use Case Landing Pages Configuration
 *
 * Defines use-case-specific landing pages for programmatic SEO.
 * These pages target specific search queries like "software for collaborative citizen journalism"
 */

export interface UseCase {
  slug: string;
  name: string;
  // SEO
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  // Page Content
  heroTitle: string;
  heroSubtitle: string;
  // Value propositions (3-4 key benefits)
  benefits: {
    title: string;
    description: string;
  }[];
  // Who is this for
  targetAudience: string[];
  // Related verticals (for internal linking)
  relatedVerticals: string[];
}

export const USE_CASES: Record<string, UseCase> = {
  'citizen-journalism': {
    slug: 'citizen-journalism',
    name: 'Citizen Journalism',
    metaTitle: 'WeWrite for Citizen Journalism - Community Reporting Platform',
    metaDescription: 'The best software for collaborative citizen journalism. Report on local issues, community events, and stories that matter. Get funded directly by your community.',
    keywords: [
      'citizen journalism software', 'collaborative citizen journalism',
      'community journalism platform', 'grassroots reporting', 'local news platform',
      'neighborhood journalism', 'citizen reporter tools', 'community news software',
      'participatory journalism', 'crowd-sourced news', 'hyperlocal journalism',
      'community-funded journalism', 'independent local news',
    ],
    heroTitle: 'Software for collaborative citizen journalism.',
    heroSubtitle: 'Report on the stories that matter to your community. Get funded directly by neighbors who want local news they can trust—not corporate sponsors with agendas.',
    benefits: [
      {
        title: 'Community-Funded Reporting',
        description: 'Your journalism is funded by the people who benefit from it, not advertisers or corporate interests.',
      },
      {
        title: 'Collaborative Storytelling',
        description: 'Work with other citizen reporters to cover complex stories with multiple perspectives.',
      },
      {
        title: 'No Editorial Gatekeepers',
        description: 'Publish immediately without waiting for editor approval. Your community decides what matters.',
      },
      {
        title: 'Build Local Trust',
        description: 'Establish yourself as a trusted voice in your community with transparent, reader-supported journalism.',
      },
    ],
    targetAudience: [
      'Community activists',
      'Local watchdogs',
      'Neighborhood advocates',
      'Former professional journalists',
      'Concerned citizens',
    ],
    relatedVerticals: ['journalists', 'local-news', 'debaters'],
  },

  'local-news': {
    slug: 'local-news',
    name: 'Local News',
    metaTitle: 'WeWrite for Local News - Hyperlocal Journalism Platform',
    metaDescription: 'Build a sustainable local news operation funded by your community. Cover city council, school boards, local businesses, and neighborhood stories.',
    keywords: [
      'local news platform', 'hyperlocal journalism', 'community news',
      'neighborhood news site', 'local journalism software', 'city news platform',
      'town news', 'regional journalism', 'local reporter platform',
      'community-funded local news', 'sustainable local journalism',
    ],
    heroTitle: 'Local news that your community actually funds.',
    heroSubtitle: 'Cover city hall, school boards, local businesses, and the stories your neighbors care about. Build sustainable local journalism funded by the people you serve.',
    benefits: [
      {
        title: 'Sustainable Model',
        description: 'Build a reader-funded local news operation that doesn\'t depend on dying ad revenue.',
      },
      {
        title: 'Community Connection',
        description: 'Your readers are your funders, creating deeper engagement and accountability.',
      },
      {
        title: 'Cover What Matters',
        description: 'Report on stories that matter to your community, not what drives clicks.',
      },
      {
        title: 'Build Local Authority',
        description: 'Become the trusted source for local news and information.',
      },
    ],
    targetAudience: [
      'Local journalists',
      'Former newspaper reporters',
      'Community bloggers',
      'City council watchers',
      'Local business owners',
    ],
    relatedVerticals: ['journalists', 'local-news'],
  },

  'independent-media': {
    slug: 'independent-media',
    name: 'Independent Media',
    metaTitle: 'WeWrite for Independent Media - Free Speech Publishing Platform',
    metaDescription: 'Publish independent media without corporate sponsors or advertiser pressure. Build an audience that funds your voice directly.',
    keywords: [
      'independent media platform', 'alternative media', 'free speech publishing',
      'uncensored news', 'independent journalism', 'media independence',
      'no corporate sponsors', 'advertiser-free media', 'reader-funded media',
      'anti-establishment media', 'independent news outlet',
    ],
    heroTitle: 'Independent media, funded by readers.',
    heroSubtitle: 'No corporate sponsors. No advertiser pressure. No algorithm suppression. Publish independent media funded directly by readers who want your perspective.',
    benefits: [
      {
        title: 'True Independence',
        description: 'No corporate owners, no advertiser relationships, no conflicts of interest.',
      },
      {
        title: 'Algorithm-Free',
        description: 'Your content reaches your audience without algorithmic suppression or shadow bans.',
      },
      {
        title: 'Direct Reader Support',
        description: 'Build a sustainable media operation funded by people who value your work.',
      },
      {
        title: 'Editorial Freedom',
        description: 'Write what you believe without worrying about platform policies or sponsor relationships.',
      },
    ],
    targetAudience: [
      'Independent journalists',
      'Political commentators',
      'Investigative reporters',
      'Media critics',
      'Alternative news creators',
    ],
    relatedVerticals: ['journalists', 'debaters'],
  },

  'creative-writing': {
    slug: 'creative-writing',
    name: 'Creative Writing',
    metaTitle: 'WeWrite for Creative Writing - Fiction & Story Publishing Platform',
    metaDescription: 'Publish your creative writing and get paid by readers who love your stories. Share fiction, poetry, essays, and creative nonfiction.',
    keywords: [
      'creative writing platform', 'fiction publishing', 'story sharing platform',
      'creative writing monetization', 'publish short stories', 'fiction writer platform',
      'creative nonfiction', 'essay publishing', 'poetry platform',
      'serialized fiction', 'web fiction platform',
    ],
    heroTitle: 'Creative writing that pays.',
    heroSubtitle: 'Share your fiction, poetry, essays, and creative nonfiction with readers who appreciate craft. Build a fanbase that supports your creative journey directly.',
    benefits: [
      {
        title: 'Direct Reader Support',
        description: 'Readers who love your work can support you directly, not through ad views.',
      },
      {
        title: 'Build Your Audience',
        description: 'Grow a dedicated readership that follows your creative journey.',
      },
      {
        title: 'Creative Freedom',
        description: 'Write what you want without worrying about algorithms or marketability.',
      },
      {
        title: 'Serialize Your Work',
        description: 'Publish novels chapter by chapter and build anticipation with your audience.',
      },
    ],
    targetAudience: [
      'Fiction writers',
      'Poets',
      'Essayists',
      'Creative nonfiction writers',
      'Aspiring novelists',
    ],
    relatedVerticals: ['writers', 'fiction-writers', 'poets'],
  },

  'academic-publishing': {
    slug: 'academic-publishing',
    name: 'Academic Publishing',
    metaTitle: 'WeWrite for Academic Publishing - Open Access Research Platform',
    metaDescription: 'Bypass academic paywalls and share your research directly with the public. Get funded by curious minds, not institutional gatekeepers.',
    keywords: [
      'academic publishing platform', 'open access', 'research sharing',
      'preprint server alternative', 'academic blogging', 'science communication',
      'scholarly publishing', 'research dissemination', 'bypass paywall',
      'public scholarship', 'academic freedom',
    ],
    heroTitle: 'Research without paywalls.',
    heroSubtitle: 'Share your academic work directly with the public. Get supported by curious minds who want access to knowledge, not locked behind institutional barriers.',
    benefits: [
      {
        title: 'Open Access',
        description: 'Your research reaches anyone who wants to read it, not just those with institutional subscriptions.',
      },
      {
        title: 'Public Engagement',
        description: 'Connect with readers beyond academia who are curious about your field.',
      },
      {
        title: 'Reader Funding',
        description: 'Get supported by people who value your research, not just grant committees.',
      },
      {
        title: 'Accessible Writing',
        description: 'Write for a broader audience and make your expertise accessible.',
      },
    ],
    targetAudience: [
      'Professors',
      'Graduate students',
      'Independent researchers',
      'Science communicators',
      'Academic writers',
    ],
    relatedVerticals: ['researchers', 'academics'],
  },

  'newsletter-creators': {
    slug: 'newsletter-creators',
    name: 'Newsletter Creators',
    metaTitle: 'WeWrite for Newsletter Creators - Substack Alternative with Lower Fees',
    metaDescription: 'Publish your newsletter with lower fees than Substack. Keep more of your earnings with direct reader support.',
    keywords: [
      'newsletter platform', 'Substack alternative', 'newsletter monetization',
      'paid newsletter', 'email newsletter platform', 'newsletter creator',
      'lower newsletter fees', 'newsletter to web', 'subscriber platform',
      'newsletter earnings', 'newsletter community',
    ],
    heroTitle: 'Your newsletter. Lower fees.',
    heroSubtitle: 'Tired of Substack taking 10%+ of your earnings? Publish your newsletter on WeWrite with direct reader support and keep more of what you make.',
    benefits: [
      {
        title: 'Lower Fees',
        description: 'Keep more of your earnings with competitive platform fees.',
      },
      {
        title: 'Web Presence',
        description: 'Your newsletter lives on the web, discoverable by search engines and shareable anywhere.',
      },
      {
        title: 'Community Features',
        description: 'Build community around your newsletter with comments and reader engagement.',
      },
      {
        title: 'Flexible Monetization',
        description: 'Let readers support you how they want—tips, subscriptions, or one-time support.',
      },
    ],
    targetAudience: [
      'Newsletter writers',
      'Substack creators',
      'Email content creators',
      'Media personalities',
      'Industry experts',
    ],
    relatedVerticals: ['newsletter-writers', 'writers'],
  },

  'tutorial-writers': {
    slug: 'tutorial-writers',
    name: 'Tutorial Writers',
    metaTitle: 'WeWrite for Tutorial Writers - How-To Content That Pays',
    metaDescription: 'Share tutorials, guides, and how-to content. Help others learn while earning from your expertise.',
    keywords: [
      'tutorial platform', 'how-to guides', 'instructional content',
      'tutorial monetization', 'teach online', 'guide publishing',
      'educational content', 'skill sharing', 'expert tutorials',
      'DIY guides', 'step-by-step tutorials',
    ],
    heroTitle: 'Teach what you know. Earn what you\'re worth.',
    heroSubtitle: 'Share your expertise through tutorials and guides. Help others learn while building a sustainable income from your knowledge.',
    benefits: [
      {
        title: 'Monetize Expertise',
        description: 'Turn your knowledge into income with reader-supported tutorials.',
      },
      {
        title: 'Help Others Learn',
        description: 'Make a difference by sharing what you know with people who need it.',
      },
      {
        title: 'Build Authority',
        description: 'Establish yourself as an expert in your field.',
      },
      {
        title: 'Evergreen Content',
        description: 'Great tutorials keep earning as new learners discover them.',
      },
    ],
    targetAudience: [
      'Subject matter experts',
      'Educators',
      'Professionals',
      'DIY enthusiasts',
      'Skill-sharers',
    ],
    relatedVerticals: ['how-to-creators', 'teachers', 'tech-writers'],
  },

  'product-reviewers': {
    slug: 'product-reviewers',
    name: 'Product Reviewers',
    metaTitle: 'WeWrite for Product Reviewers - Honest Reviews Funded by Readers',
    metaDescription: 'Write honest product reviews without sponsor pressure. Get funded by readers who value unbiased opinions.',
    keywords: [
      'product review platform', 'honest reviews', 'unbiased reviews',
      'independent reviewer', 'review monetization', 'consumer reviews',
      'tech reviews', 'gadget reviews', 'comparison reviews',
      'reader-funded reviews', 'no sponsored reviews',
    ],
    heroTitle: 'Honest reviews. Reader-funded.',
    heroSubtitle: 'Write unbiased product reviews without sponsor pressure. Your readers fund your integrity, not companies seeking favorable coverage.',
    benefits: [
      {
        title: 'True Independence',
        description: 'No sponsor relationships means no pressure to write favorable reviews.',
      },
      {
        title: 'Reader Trust',
        description: 'Build credibility with honest opinions that readers can rely on.',
      },
      {
        title: 'Sustainable Model',
        description: 'Get paid by readers who value honest reviews, not by brands.',
      },
      {
        title: 'Editorial Freedom',
        description: 'Review what you want, say what you think.',
      },
    ],
    targetAudience: [
      'Tech reviewers',
      'Product testers',
      'Consumer advocates',
      'Comparison writers',
      'Industry analysts',
    ],
    relatedVerticals: ['reviewers', 'tech-writers'],
  },

  'travel-blogging': {
    slug: 'travel-blogging',
    name: 'Travel Blogging',
    metaTitle: 'WeWrite for Travel Blogging - Travel Content That Pays',
    metaDescription: 'Share destination guides and travel stories funded by readers, not tourism sponsors. Build authentic travel content.',
    keywords: [
      'travel blogging platform', 'travel writing', 'destination guides',
      'travel monetization', 'travel content', 'adventure writing',
      'travel tips', 'travel stories', 'authentic travel blog',
      'reader-funded travel', 'independent travel writer',
    ],
    heroTitle: 'Travel writing without sponsor strings.',
    heroSubtitle: 'Share authentic destination guides and travel stories. Get funded by readers planning their own adventures, not tourism boards with agendas.',
    benefits: [
      {
        title: 'Authentic Voice',
        description: 'Share honest experiences without worrying about sponsor relationships.',
      },
      {
        title: 'Reader Support',
        description: 'Get funded by travelers who value real recommendations.',
      },
      {
        title: 'Build Community',
        description: 'Connect with readers who share your love of travel.',
      },
      {
        title: 'Fund Adventures',
        description: 'Turn your travel passion into sustainable income.',
      },
    ],
    targetAudience: [
      'Travel bloggers',
      'Adventure writers',
      'Digital nomads',
      'Destination experts',
      'Travel photographers',
    ],
    relatedVerticals: ['travel-writers'],
  },

  'tech-blogging': {
    slug: 'tech-blogging',
    name: 'Tech Blogging',
    metaTitle: 'WeWrite for Tech Blogging - Developer Content That Pays',
    metaDescription: 'Share programming tutorials, tech reviews, and developer insights. Build an audience that supports your tech content.',
    keywords: [
      'tech blogging platform', 'developer blog', 'programming tutorials',
      'tech writing monetization', 'coding guides', 'software writing',
      'tech reviews', 'developer content', 'programming content',
      'tech community', 'coding blog',
    ],
    heroTitle: 'Tech content that your audience supports.',
    heroSubtitle: 'Share programming tutorials, tech reviews, and developer insights. Build an audience of tech enthusiasts who fund your content directly.',
    benefits: [
      {
        title: 'Developer Community',
        description: 'Connect with fellow developers who appreciate quality technical content.',
      },
      {
        title: 'Monetize Expertise',
        description: 'Turn your technical knowledge into sustainable income.',
      },
      {
        title: 'Build Authority',
        description: 'Establish yourself as a trusted voice in your technical niche.',
      },
      {
        title: 'No Ad Clutter',
        description: 'Clean reading experience without intrusive advertising.',
      },
    ],
    targetAudience: [
      'Software developers',
      'Tech writers',
      'DevRel professionals',
      'Open source contributors',
      'Tech educators',
    ],
    relatedVerticals: ['tech-writers', 'how-to-creators'],
  },

  'sports-commentary': {
    slug: 'sports-commentary',
    name: 'Sports Commentary',
    metaTitle: 'WeWrite for Sports Commentary - Fan-Funded Sports Analysis',
    metaDescription: 'Share sports analysis, game coverage, and commentary. Build a fanbase that supports your sports writing.',
    keywords: [
      'sports commentary platform', 'sports writing', 'game analysis',
      'sports journalism', 'fan-funded sports', 'sports opinion',
      'team coverage', 'player analysis', 'sports blogging',
      'sports prediction', 'fantasy sports content',
    ],
    heroTitle: 'Sports analysis funded by fans.',
    heroSubtitle: 'Share game coverage, player analysis, and sports commentary. Build a fanbase that pays for your insights and predictions.',
    benefits: [
      {
        title: 'Fan Support',
        description: 'Get funded by fans who value your analysis and predictions.',
      },
      {
        title: 'Build Following',
        description: 'Grow a dedicated audience of sports fans.',
      },
      {
        title: 'Cover Your Teams',
        description: 'Write about the teams and sports you\'re passionate about.',
      },
      {
        title: 'No Credential Requirements',
        description: 'You don\'t need a press pass to share great analysis.',
      },
    ],
    targetAudience: [
      'Sports enthusiasts',
      'Fantasy sports players',
      'Former athletes',
      'Sports statisticians',
      'Team superfans',
    ],
    relatedVerticals: ['sports-writers'],
  },

  'food-blogging': {
    slug: 'food-blogging',
    name: 'Food Blogging',
    metaTitle: 'WeWrite for Food Blogging - Restaurant Reviews That Pay',
    metaDescription: 'Share authentic restaurant reviews and food content funded by readers, not restaurants. Build honest culinary content.',
    keywords: [
      'food blogging platform', 'restaurant reviews', 'food writing',
      'culinary content', 'food criticism', 'dining reviews',
      'recipe sharing', 'food monetization', 'authentic food reviews',
      'reader-funded food blog', 'independent food critic',
    ],
    heroTitle: 'Food content without comped meals.',
    heroSubtitle: 'Share authentic restaurant reviews and culinary content. Get funded by readers who want honest food recommendations, not restaurants seeking coverage.',
    benefits: [
      {
        title: 'Honest Reviews',
        description: 'Share authentic opinions without restaurant relationship pressure.',
      },
      {
        title: 'Reader Trust',
        description: 'Build credibility with honest recommendations readers can rely on.',
      },
      {
        title: 'Culinary Community',
        description: 'Connect with food lovers who share your passion.',
      },
      {
        title: 'Monetize Taste',
        description: 'Turn your culinary expertise into sustainable income.',
      },
    ],
    targetAudience: [
      'Food bloggers',
      'Restaurant critics',
      'Home cooks',
      'Culinary enthusiasts',
      'Recipe creators',
    ],
    relatedVerticals: ['food-critics'],
  },

  'parenting-content': {
    slug: 'parenting-content',
    name: 'Parenting Content',
    metaTitle: 'WeWrite for Parenting Content - Authentic Family Stories That Pay',
    metaDescription: 'Share real parenting experiences and family stories. Build a community of parents who support authentic voices.',
    keywords: [
      'parenting blog platform', 'family content', 'parenting stories',
      'mom blog', 'dad blog', 'parenting advice', 'family writing',
      'authentic parenting', 'parent community', 'parenting monetization',
    ],
    heroTitle: 'Real parenting. Real support.',
    heroSubtitle: 'Share authentic parenting experiences and family stories. Connect with other parents who value real voices over sponsored perfection.',
    benefits: [
      {
        title: 'Authentic Community',
        description: 'Connect with parents who appreciate real stories over perfect Instagram lives.',
      },
      {
        title: 'No Sponsor Pressure',
        description: 'Share honest experiences without product placement requirements.',
      },
      {
        title: 'Support System',
        description: 'Build a community of parents supporting each other.',
      },
      {
        title: 'Monetize Experience',
        description: 'Turn your parenting journey into sustainable income.',
      },
    ],
    targetAudience: [
      'Parents',
      'Caregivers',
      'Family bloggers',
      'Parenting experts',
      'Child development professionals',
    ],
    relatedVerticals: ['parenting-writers'],
  },

  'faith-based-writing': {
    slug: 'faith-based-writing',
    name: 'Faith-Based Writing',
    metaTitle: 'WeWrite for Faith Writing - Spiritual Content That Pays',
    metaDescription: 'Share your faith, spiritual insights, and religious content. Build a community that supports your ministry.',
    keywords: [
      'faith writing platform', 'religious blog', 'spiritual content',
      'ministry platform', 'Christian writing', 'faith community',
      'devotional writing', 'religious journalism', 'faith monetization',
      'spiritual growth', 'church content',
    ],
    heroTitle: 'Share your faith. Build your ministry.',
    heroSubtitle: 'Write about spirituality, faith, and religious topics. Build a community of believers who support your spiritual content directly.',
    benefits: [
      {
        title: 'Ministry Support',
        description: 'Get funded by believers who value your spiritual content.',
      },
      {
        title: 'Faith Community',
        description: 'Build a community around shared faith and values.',
      },
      {
        title: 'Reach Seekers',
        description: 'Share your faith with people searching for spiritual guidance.',
      },
      {
        title: 'Devotional Platform',
        description: 'Share daily devotionals, Bible studies, and spiritual insights.',
      },
    ],
    targetAudience: [
      'Pastors',
      'Ministry leaders',
      'Faith bloggers',
      'Spiritual writers',
      'Religious educators',
    ],
    relatedVerticals: ['faith-writers'],
  },

  'health-wellness': {
    slug: 'health-wellness',
    name: 'Health & Wellness',
    metaTitle: 'WeWrite for Health & Wellness - Wellness Content That Pays',
    metaDescription: 'Share health and wellness content without advertiser pressure. Build a community that supports evidence-based health writing.',
    keywords: [
      'health blog platform', 'wellness content', 'fitness writing',
      'health journalism', 'nutrition writing', 'mental health content',
      'wellness monetization', 'health tips', 'evidence-based health',
      'holistic health', 'health education',
    ],
    heroTitle: 'Health content without supplement sponsors.',
    heroSubtitle: 'Share health, fitness, and wellness content without advertiser pressure. Build a community that values evidence-based health information.',
    benefits: [
      {
        title: 'Evidence-Based',
        description: 'Share accurate health information without sponsor pressure to promote products.',
      },
      {
        title: 'Reader Trust',
        description: 'Build credibility with honest, well-researched content.',
      },
      {
        title: 'Wellness Community',
        description: 'Connect with readers committed to their health journey.',
      },
      {
        title: 'Sustainable Income',
        description: 'Get funded by readers who value quality health content.',
      },
    ],
    targetAudience: [
      'Health writers',
      'Fitness professionals',
      'Nutritionists',
      'Mental health advocates',
      'Wellness coaches',
    ],
    relatedVerticals: ['health-writers'],
  },

  'financial-content': {
    slug: 'financial-content',
    name: 'Financial Content',
    metaTitle: 'WeWrite for Financial Content - Money Tips Without Sponsor Bias',
    metaDescription: 'Share financial insights and money tips without financial product sponsors. Get funded by readers who want honest financial content.',
    keywords: [
      'finance blog platform', 'financial content', 'money tips',
      'investing content', 'personal finance', 'financial journalism',
      'finance monetization', 'economic analysis', 'financial advice',
      'honest financial content', 'reader-funded finance',
    ],
    heroTitle: 'Financial content without sponsor bias.',
    heroSubtitle: 'Share investment analysis, money tips, and financial education. Get funded by readers who want honest advice, not financial product sponsors.',
    benefits: [
      {
        title: 'No Conflicts',
        description: 'Share honest financial advice without sponsor relationships.',
      },
      {
        title: 'Reader Trust',
        description: 'Build credibility with unbiased financial content.',
      },
      {
        title: 'Expert Voice',
        description: 'Establish yourself as a trusted financial voice.',
      },
      {
        title: 'Sustainable Model',
        description: 'Get funded by readers who value honest financial guidance.',
      },
    ],
    targetAudience: [
      'Financial writers',
      'Investment analysts',
      'Personal finance experts',
      'Economic commentators',
      'Money coaches',
    ],
    relatedVerticals: ['finance-writers'],
  },
};

/**
 * Get all use case slugs for static page generation
 */
export function getUseCaseSlugs(): string[] {
  return Object.keys(USE_CASES);
}

/**
 * Get a use case by slug
 */
export function getUseCase(slug: string): UseCase | undefined {
  return USE_CASES[slug];
}

/**
 * Check if a slug is a valid use case
 */
export function isValidUseCase(slug: string): boolean {
  return slug in USE_CASES;
}

/**
 * Get all use cases
 */
export function getAllUseCases(): UseCase[] {
  return Object.values(USE_CASES);
}
