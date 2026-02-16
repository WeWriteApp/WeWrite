import type { OGImageType } from '../types';

export const OG_IMAGE_TYPES: OGImageType[] = [
  // === BRANDING IMAGES ===
  {
    id: 'default',
    name: 'Default WeWrite',
    description: 'Default branding image shown when sharing the homepage.',
    route: '/opengraph-image',
    usedIn: ['Homepage', 'Fallback'],
    customParams: {},
    section: 'branding',
  },
  {
    id: 'api-default',
    name: 'API Default',
    description: 'API route returning WeWrite branding when no page ID provided.',
    route: '/api/og',
    usedIn: ['API fallback'],
    customParams: {},
    section: 'branding',
  },

  // === USER PROFILES ===
  {
    id: 'user-profile',
    name: 'User Profile',
    description: 'Dynamic OG image for user profile pages showing username, bio, and page count.',
    route: '/u/jamie/opengraph-image',
    usedIn: ['User profiles', 'Social shares'],
    customParams: {},
    section: 'user',
  },

  // === AUTH PAGES ===
  {
    id: 'auth-login',
    name: 'Login Page',
    description: 'OG image for the login page with form preview.',
    route: '/auth/login/opengraph-image',
    usedIn: ['Login page'],
    customParams: {},
    section: 'auth',
  },
  {
    id: 'auth-register',
    name: 'Register Page',
    description: 'OG image for the registration page with signup form preview.',
    route: '/auth/register/opengraph-image',
    usedIn: ['Registration page'],
    customParams: {},
    section: 'auth',
  },

  // === STATIC PAGES ===
  {
    id: 'home-feed',
    name: 'Home Feed',
    description: 'OG image for the logged-in home feed page.',
    route: '/home/opengraph-image',
    usedIn: ['Home page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'trending',
    name: 'Trending',
    description: 'OG image for the trending pages view.',
    route: '/trending/opengraph-image',
    usedIn: ['Trending page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'search',
    name: 'Search',
    description: 'OG image for the search page.',
    route: '/search/opengraph-image',
    usedIn: ['Search page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'leaderboard',
    name: 'Leaderboard',
    description: 'OG image for the leaderboard page.',
    route: '/leaderboard/opengraph-image',
    usedIn: ['Leaderboard page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'invite',
    name: 'Invite Friends',
    description: 'OG image for the referral invite page.',
    route: '/invite/opengraph-image',
    usedIn: ['Invite page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'OG image for the welcome/landing page.',
    route: '/welcome/opengraph-image',
    usedIn: ['Welcome page', 'Landing pages'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'terms',
    name: 'Terms of Service',
    description: 'OG image for the terms of service page.',
    route: '/terms/opengraph-image',
    usedIn: ['Terms page'],
    customParams: {},
    section: 'static',
  },
  {
    id: 'privacy',
    name: 'Privacy Policy',
    description: 'OG image for the privacy policy page.',
    route: '/privacy/opengraph-image',
    usedIn: ['Privacy page'],
    customParams: {},
    section: 'static',
  },

  // === CONTENT PAGE VARIANTS ===
  {
    id: 'content-page-sample',
    name: 'Content Page (Sample)',
    description: 'Dynamic OG image with title, author, content preview.',
    route: '/api/og',
    params: {
      id: 'Page ID',
      title: 'Page title',
      author: 'Author username',
      content: 'Content preview',
      sponsors: 'Sponsor count',
    },
    usedIn: ['Content pages', 'Social shares'],
    customParams: {
      title: 'The Future of AI in Education',
      author: 'sarah_chen',
      content: 'Exploring how artificial intelligence is transforming learning experiences for millions of students worldwide. From personalized tutoring with Khan Academy to adaptive curricula that adjust to individual learning styles, AI is reshaping education. Schools use machine learning to identify learning gaps and create customized study plans. Teachers leverage Gradescope and automated essay scoring to manage workloads. Startups like Duolingo use gamification and AI to make learning languages engaging. Institutions implement intelligent tutoring systems for personalized feedback. AI-powered platforms analyze student performance data in real-time.',
      sponsors: '12',
    },
    section: 'content',
  },
  {
    id: 'content-with-sponsors',
    name: 'Page with Sponsors',
    description: 'Content page showing sponsor count badge.',
    route: '/api/og',
    usedIn: ['Popular pages'],
    customParams: {
      title: 'How to Build a Sustainable Startup',
      author: 'alex_rivera',
      content: "A comprehensive guide to building businesses that balance profit with purpose while maintaining competitive advantage. Learn actionable strategies via B Lab certification, ESG frameworks, and conscious capitalism principles. Discover how companies like Patagonia and Ben & Jerry's built billion-dollar brands on sustainability. Explore funding options through impact investors and ESG-focused venture capital firms. Implement circular economy practices, carbon offsetting, and ethical supply chain management. Learn about double bottom-line reporting, stakeholder capitalism, and stakeholder engagement models that drive long-term value creation.",
      sponsors: '47',
    },
    section: 'content',
  },
  {
    id: 'content-no-sponsors',
    name: 'Page without Sponsors',
    description: 'Content page with no sponsor badge.',
    route: '/api/og',
    usedIn: ['New pages'],
    customParams: {
      title: 'Homemade Sourdough Starter Guide',
      author: 'baker_mike',
      content: 'Everything you need about creating and maintaining sourdough starter from scratch. Day one feeding schedules, weekly maintenance routines, and troubleshooting with expert baking resources. Understand the fermentation science behind wild yeast and bacteria cultures. Learn temperature control techniques, hydration ratios, and achieving the perfect crumb structure. Discover common starter problems like mold and separation, with proven solutions. Master the autolyse method, stretch-and-fold techniques, and optimal baking temperatures for crispy crust. Explore different flour types and their effects on fermentation and flavor development.',
      sponsors: '0',
    },
    section: 'content',
  },
  {
    id: 'content-long-title',
    name: 'Long Title',
    description: 'Tests title truncation with very long page title.',
    route: '/api/og',
    usedIn: ['Edge case testing'],
    customParams: {
      title: 'The Comprehensive Guide to Understanding Blockchain Technology: How Distributed Ledgers Are Revolutionizing Finance, Supply Chains, and Beyond',
      author: 'crypto_professor',
      content: 'An in-depth exploration of blockchain fundamentals using Bitcoin and Ethereum as primary case studies. Understand the cryptographic principles that secure decentralized networks. Explore smart contracts on Solana and Polygon, NFTs and tokenomics, and DeFi protocols reshaping finance. Discover real-world applications across supply chain management, healthcare data sharing, and voting systems. Learn about consensus mechanisms like Proof of Work and Proof of Stake, transaction throughput, and layer-two scaling solutions. Understand regulatory landscapes and enterprise blockchain implementations. Explore emerging use cases in digital identity.',
      sponsors: '23',
    },
    section: 'content',
  },
  {
    id: 'api-png',
    name: 'PNG Format',
    description: 'Same as content page but served from /api/og.png route.',
    route: '/api/og.png',
    usedIn: ['Alternative endpoint'],
    customParams: {
      title: 'Photography 101: Mastering Light and Composition',
      author: 'lens_master',
      content: 'Learn photography fundamentals including exposure control, ISO sensitivity, and aperture priority modes. Master zone system and metering techniques for perfect exposure. Study composition rules like the rule of thirds, leading lines, and framing techniques. Understand color theory, white balance, and how light direction affects mood and dimension. Learn post-processing workflows with professional tools for stunning results. Explore different genres from portrait lighting to landscape and macro photography. Study masters like Henri Cartier-Bresson to develop artistic vision. Practice advanced techniques like bracketing, focus stacking, and creative use of depth of field.',
      sponsors: '8',
    },
    section: 'content',
  },
];

// Routes that need OG image audit - these don't have dedicated opengraph-image files
// Note: All major routes now have custom OG images as of Dec 2024
export const ROUTES_NEEDING_AUDIT: { path: string; description: string; priority: string }[] = [
  // All previously listed routes now have custom OG images!
];
