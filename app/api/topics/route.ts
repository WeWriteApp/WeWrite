/**
 * Topics API
 *
 * Returns pages grouped by topic/tag for SEO landing pages.
 * GET /api/topics - List all topics with page counts
 * GET /api/topics?topic=technology - Get pages for a specific topic
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

export const maxDuration = 30;

// Predefined topics that we want to create landing pages for
// These are common writing topics that are likely to have content
const PREDEFINED_TOPICS = [
  'technology',
  'writing',
  'creativity',
  'business',
  'personal',
  'tutorial',
  'philosophy',
  'science',
  'art',
  'music',
  'travel',
  'food',
  'health',
  'education',
  'finance',
  'lifestyle',
  'productivity',
  'programming',
  'design',
  'marketing'
];

interface TopicResult {
  topic: string;
  pageCount: number;
  recentPages: Array<{
    id: string;
    title: string;
    username: string;
    lastModified: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const db = admin.firestore();
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic')?.toLowerCase();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    if (topic) {
      // Get pages for a specific topic
      // Search in title and content for topic-related keywords
      const pagesRef = db.collection(getCollectionName('pages'));

      // Query pages that are public and not deleted
      // We'll filter by topic in title (Firestore doesn't support full-text search)
      const snapshot = await pagesRef
        .where('isPublic', '==', true)
        .orderBy('lastModified', 'desc')
        .limit(200) // Get more to filter
        .get();

      const topicKeywords = getTopicKeywords(topic);
      const matchingPages: Array<{
        id: string;
        title: string;
        username: string;
        userId: string;
        lastModified: string;
        viewCount: number;
        excerpt: string;
      }> = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.deleted) continue;

        const title = (data.title || '').toLowerCase();
        const tags = (data.tags || []).map((t: string) => t.toLowerCase());

        // Check if page matches topic
        const matchesTitle = topicKeywords.some(kw => title.includes(kw));
        const matchesTags = tags.some((tag: string) =>
          topicKeywords.some(kw => tag.includes(kw) || kw.includes(tag))
        );

        if (matchesTitle || matchesTags) {
          // Extract excerpt from content
          let excerpt = '';
          if (data.content && Array.isArray(data.content)) {
            const firstParagraph = data.content.find((node: any) =>
              node.children?.[0]?.text
            );
            excerpt = firstParagraph?.children?.[0]?.text?.slice(0, 150) || '';
          }

          matchingPages.push({
            id: doc.id,
            title: data.title || 'Untitled',
            username: data.username || 'Unknown',
            userId: data.userId,
            lastModified: data.lastModified?.toDate?.()?.toISOString() ||
                         data.lastModified || new Date().toISOString(),
            viewCount: data.viewCount || 0,
            excerpt
          });

          if (matchingPages.length >= limit) break;
        }
      }

      return NextResponse.json({
        success: true,
        topic,
        pageCount: matchingPages.length,
        pages: matchingPages
      });

    } else {
      // List all predefined topics with counts
      const pagesRef = db.collection(getCollectionName('pages'));

      // Get a sample of recent public pages to count topics
      const snapshot = await pagesRef
        .where('isPublic', '==', true)
        .orderBy('lastModified', 'desc')
        .limit(500)
        .get();

      const topicCounts: Record<string, number> = {};
      PREDEFINED_TOPICS.forEach(t => topicCounts[t] = 0);

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.deleted) continue;

        const title = (data.title || '').toLowerCase();
        const tags = (data.tags || []).map((t: string) => t.toLowerCase());

        // Check which topics this page matches
        for (const topic of PREDEFINED_TOPICS) {
          const keywords = getTopicKeywords(topic);
          const matchesTitle = keywords.some(kw => title.includes(kw));
          const matchesTags = tags.some((tag: string) =>
            keywords.some(kw => tag.includes(kw) || kw.includes(tag))
          );

          if (matchesTitle || matchesTags) {
            topicCounts[topic]++;
          }
        }
      }

      // Sort by count and filter out empty topics
      const topics = Object.entries(topicCounts)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([topic, count]) => ({
          topic,
          slug: topic,
          pageCount: count,
          displayName: topic.charAt(0).toUpperCase() + topic.slice(1)
        }));

      return NextResponse.json({
        success: true,
        topics,
        totalTopics: topics.length
      });
    }

  } catch (error) {
    console.error('Topics API error:', error);
    return NextResponse.json({
      error: 'Failed to fetch topics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get expanded keywords for a topic to improve matching
 */
function getTopicKeywords(topic: string): string[] {
  const keywordMap: Record<string, string[]> = {
    technology: ['tech', 'technology', 'software', 'hardware', 'digital', 'computer', 'ai', 'machine learning', 'coding'],
    writing: ['writing', 'writer', 'write', 'author', 'storytelling', 'fiction', 'non-fiction', 'creative writing'],
    creativity: ['creative', 'creativity', 'art', 'artistic', 'imagination', 'innovative'],
    business: ['business', 'entrepreneur', 'startup', 'company', 'enterprise', 'commerce', 'corporate'],
    personal: ['personal', 'life', 'reflection', 'journal', 'diary', 'thoughts', 'experience'],
    tutorial: ['tutorial', 'guide', 'how to', 'howto', 'learn', 'lesson', 'step by step', 'instructions'],
    philosophy: ['philosophy', 'philosophical', 'ethics', 'morality', 'meaning', 'existence', 'wisdom'],
    science: ['science', 'scientific', 'research', 'study', 'experiment', 'discovery', 'biology', 'physics', 'chemistry'],
    art: ['art', 'artistic', 'painting', 'drawing', 'sculpture', 'gallery', 'museum', 'artwork'],
    music: ['music', 'musical', 'song', 'album', 'artist', 'concert', 'band', 'melody', 'rhythm'],
    travel: ['travel', 'trip', 'journey', 'adventure', 'destination', 'explore', 'vacation', 'tourism'],
    food: ['food', 'recipe', 'cooking', 'cuisine', 'restaurant', 'meal', 'dish', 'culinary'],
    health: ['health', 'healthy', 'wellness', 'fitness', 'medical', 'exercise', 'nutrition', 'mental health'],
    education: ['education', 'learning', 'school', 'university', 'teaching', 'student', 'academic'],
    finance: ['finance', 'financial', 'money', 'investing', 'investment', 'economics', 'budget', 'wealth'],
    lifestyle: ['lifestyle', 'living', 'daily', 'routine', 'habit', 'balance', 'mindful'],
    productivity: ['productivity', 'productive', 'efficiency', 'time management', 'workflow', 'organize'],
    programming: ['programming', 'code', 'coding', 'developer', 'software', 'javascript', 'python', 'web development'],
    design: ['design', 'designer', 'ui', 'ux', 'graphic', 'visual', 'interface', 'layout'],
    marketing: ['marketing', 'advertising', 'brand', 'branding', 'promotion', 'social media', 'seo', 'content marketing']
  };

  return keywordMap[topic] || [topic];
}
