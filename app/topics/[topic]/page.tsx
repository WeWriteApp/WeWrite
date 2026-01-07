import type { Metadata } from 'next';
import TopicPageClient from './TopicPageClient';
import { TOPIC_KEYWORDS, ALL_TOPICS } from '../../constants/seo-keywords';

/**
 * Extended topic list for SEO coverage
 * Includes all topics from our keyword database plus additional common topics
 */
const TOPICS = [
  // Original topics
  'technology', 'writing', 'creativity', 'business', 'personal',
  'tutorial', 'philosophy', 'science', 'art', 'music',
  'travel', 'food', 'health', 'education', 'finance',
  'lifestyle', 'productivity', 'programming', 'design', 'marketing',
  // Expanded topics for better SEO coverage
  'politics', 'entertainment', 'sports', 'parenting', 'relationships',
  'spirituality', 'gaming', 'diy', 'photography', 'pets',
  'currentEvents', 'opinion', 'tutorials', 'reviews', 'history',
  'environment', 'news', 'journalism', 'fiction', 'poetry',
  'essays', 'memoir', 'selfImprovement', 'mentalHealth', 'fitness',
  'nutrition', 'cooking', 'homeImprovement', 'gardening', 'crafts',
  'startups', 'entrepreneurship', 'investing', 'cryptocurrency', 'economics',
  'law', 'medicine', 'engineering', 'mathematics', 'psychology',
  'sociology', 'anthropology', 'linguistics', 'literature', 'film',
  'television', 'theater', 'dance', 'fashion', 'beauty',
  'automotive', 'aviation', 'military', 'space', 'outdoors',
];

/**
 * Topic display names and descriptions for better SEO
 */
const TOPIC_META: Record<string, { displayName: string; description: string }> = {
  technology: { displayName: 'Technology', description: 'tech news, software reviews, coding tutorials, and startup stories' },
  writing: { displayName: 'Writing', description: 'writing tips, creative writing, storytelling techniques, and author insights' },
  creativity: { displayName: 'Creativity', description: 'creative process, artistic inspiration, and innovative thinking' },
  business: { displayName: 'Business', description: 'business insights, entrepreneurship, startup advice, and leadership' },
  personal: { displayName: 'Personal', description: 'personal stories, life experiences, and reflections' },
  tutorial: { displayName: 'Tutorials', description: 'how-to guides, step-by-step tutorials, and learning resources' },
  philosophy: { displayName: 'Philosophy', description: 'philosophical essays, ethics discussion, and thought experiments' },
  science: { displayName: 'Science', description: 'science news, research updates, and scientific discovery' },
  art: { displayName: 'Art', description: 'art criticism, artist profiles, and creative process' },
  music: { displayName: 'Music', description: 'music reviews, album analysis, and artist interviews' },
  travel: { displayName: 'Travel', description: 'travel guides, destination reviews, and adventure stories' },
  food: { displayName: 'Food', description: 'restaurant reviews, recipes, and culinary stories' },
  health: { displayName: 'Health', description: 'health articles, wellness content, and fitness tips' },
  education: { displayName: 'Education', description: 'educational content, learning resources, and teaching tips' },
  finance: { displayName: 'Finance', description: 'financial advice, investing content, and money tips' },
  lifestyle: { displayName: 'Lifestyle', description: 'lifestyle content, personal development, and life advice' },
  productivity: { displayName: 'Productivity', description: 'productivity tips, time management, and life hacks' },
  programming: { displayName: 'Programming', description: 'coding tutorials, software development, and developer insights' },
  design: { displayName: 'Design', description: 'design thinking, UI/UX, and visual creativity' },
  marketing: { displayName: 'Marketing', description: 'marketing strategies, content marketing, and growth tactics' },
  politics: { displayName: 'Politics', description: 'political commentary, policy analysis, and civic engagement' },
  entertainment: { displayName: 'Entertainment', description: 'movie reviews, TV analysis, and pop culture' },
  sports: { displayName: 'Sports', description: 'sports commentary, game analysis, and athletic coverage' },
  parenting: { displayName: 'Parenting', description: 'parenting advice, family content, and child development' },
  relationships: { displayName: 'Relationships', description: 'relationship advice, dating tips, and connection' },
  spirituality: { displayName: 'Spirituality', description: 'spiritual writing, faith content, and mindfulness' },
  gaming: { displayName: 'Gaming', description: 'game reviews, gaming news, and esports coverage' },
  diy: { displayName: 'DIY', description: 'DIY tutorials, crafts, and home improvement projects' },
  photography: { displayName: 'Photography', description: 'photography tips, photo essays, and visual storytelling' },
  pets: { displayName: 'Pets', description: 'pet care, animal stories, and veterinary tips' },
  currentEvents: { displayName: 'Current Events', description: 'news analysis, breaking news commentary, and world events' },
  opinion: { displayName: 'Opinion', description: 'opinion pieces, editorial content, and commentary' },
  tutorials: { displayName: 'Tutorials', description: 'how-to guides, instructional content, and skill building' },
  reviews: { displayName: 'Reviews', description: 'product reviews, service reviews, and buyer guides' },
  history: { displayName: 'History', description: 'historical analysis, history articles, and historical research' },
  environment: { displayName: 'Environment', description: 'environmental news, climate writing, and sustainability' },
  news: { displayName: 'News', description: 'news coverage, journalism, and current affairs' },
  journalism: { displayName: 'Journalism', description: 'independent journalism, investigative reporting, and press freedom' },
  fiction: { displayName: 'Fiction', description: 'short stories, serialized fiction, and creative writing' },
  poetry: { displayName: 'Poetry', description: 'poems, verse, and literary poetry' },
  essays: { displayName: 'Essays', description: 'personal essays, literary essays, and long-form writing' },
  memoir: { displayName: 'Memoir', description: 'personal memoirs, life stories, and autobiographical writing' },
  selfImprovement: { displayName: 'Self-Improvement', description: 'personal development, self-help, and growth mindset' },
  mentalHealth: { displayName: 'Mental Health', description: 'mental health content, psychology, and emotional wellness' },
  fitness: { displayName: 'Fitness', description: 'fitness tips, workout guides, and exercise routines' },
  nutrition: { displayName: 'Nutrition', description: 'nutrition advice, healthy eating, and diet tips' },
  cooking: { displayName: 'Cooking', description: 'recipes, cooking tips, and culinary techniques' },
  homeImprovement: { displayName: 'Home Improvement', description: 'home renovation, DIY projects, and interior design' },
  gardening: { displayName: 'Gardening', description: 'gardening tips, plant care, and landscaping' },
  crafts: { displayName: 'Crafts', description: 'craft projects, handmade creations, and maker content' },
  startups: { displayName: 'Startups', description: 'startup stories, founder insights, and entrepreneurship' },
  entrepreneurship: { displayName: 'Entrepreneurship', description: 'business building, founder stories, and startup advice' },
  investing: { displayName: 'Investing', description: 'investment strategies, market analysis, and wealth building' },
  cryptocurrency: { displayName: 'Cryptocurrency', description: 'crypto news, blockchain, and digital assets' },
  economics: { displayName: 'Economics', description: 'economic analysis, market trends, and financial policy' },
  law: { displayName: 'Law', description: 'legal analysis, law commentary, and justice issues' },
  medicine: { displayName: 'Medicine', description: 'medical writing, healthcare, and clinical insights' },
  engineering: { displayName: 'Engineering', description: 'engineering topics, technical projects, and innovation' },
  mathematics: { displayName: 'Mathematics', description: 'math concepts, mathematical thinking, and problem solving' },
  psychology: { displayName: 'Psychology', description: 'psychology articles, behavioral science, and mental processes' },
  sociology: { displayName: 'Sociology', description: 'social analysis, cultural commentary, and society' },
  anthropology: { displayName: 'Anthropology', description: 'human cultures, societies, and anthropological insights' },
  linguistics: { displayName: 'Linguistics', description: 'language analysis, linguistic topics, and communication' },
  literature: { displayName: 'Literature', description: 'literary analysis, book reviews, and literary criticism' },
  film: { displayName: 'Film', description: 'movie reviews, film analysis, and cinema criticism' },
  television: { displayName: 'Television', description: 'TV reviews, show analysis, and streaming content' },
  theater: { displayName: 'Theater', description: 'theater reviews, performance art, and stage productions' },
  dance: { displayName: 'Dance', description: 'dance content, choreography, and movement arts' },
  fashion: { displayName: 'Fashion', description: 'fashion trends, style guides, and clothing' },
  beauty: { displayName: 'Beauty', description: 'beauty tips, skincare, and cosmetics' },
  automotive: { displayName: 'Automotive', description: 'car reviews, automotive news, and vehicle content' },
  aviation: { displayName: 'Aviation', description: 'aviation content, flight, and aerospace' },
  military: { displayName: 'Military', description: 'military topics, defense, and veteran stories' },
  space: { displayName: 'Space', description: 'space exploration, astronomy, and cosmic discoveries' },
  outdoors: { displayName: 'Outdoors', description: 'outdoor adventures, hiking, and nature exploration' },
};

// Generate static params for all topics
export async function generateStaticParams() {
  return TOPICS.map((topic) => ({
    topic: topic,
  }));
}

/**
 * Get topic keywords from our SEO database or generate defaults
 */
function getTopicKeywords(topic: string): string[] {
  // Check if we have predefined keywords in our database
  const predefinedKeywords = TOPIC_KEYWORDS[topic];
  if (predefinedKeywords && predefinedKeywords.length > 0) {
    return [
      topic,
      ...predefinedKeywords,
      `${topic} articles`,
      `${topic} writing`,
      'wewrite',
    ];
  }

  // Generate default keywords
  const displayName = TOPIC_META[topic]?.displayName || topic;
  return [
    topic,
    `${topic} articles`,
    `${topic} writing`,
    `${topic} content`,
    `${displayName.toLowerCase()} platform`,
    `read about ${topic}`,
    'wewrite',
  ];
}

// Generate metadata for each topic page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const meta = TOPIC_META[topic] || {
    displayName: topic.charAt(0).toUpperCase() + topic.slice(1).replace(/([A-Z])/g, ' $1'),
    description: `${topic} articles and content`,
  };
  const canonicalUrl = `https://www.getwewrite.app/topics/${topic}`;
  const keywords = getTopicKeywords(topic);

  return {
    title: `${meta.displayName} Articles`,
    description: `Discover ${meta.description} on WeWrite. Read insights, tutorials, and stories from our community of writers.`,
    keywords: keywords,
    openGraph: {
      title: `${meta.displayName} Articles on WeWrite`,
      description: `Discover ${meta.description} from our community of writers.`,
      type: 'website',
      url: canonicalUrl,
    },
    twitter: {
      card: 'summary',
      title: `${meta.displayName} Articles on WeWrite`,
      description: `Discover ${meta.description} from our community of writers.`,
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  return <TopicPageClient topic={topic} />;
}
