/**
 * ServerContentForSEO - Server-rendered content for search engine indexing
 *
 * This component renders page content as plain HTML that search engines can crawl.
 * It's rendered server-side and included in the initial HTML response.
 *
 * The content is visually hidden but accessible to crawlers via:
 * - Semantic HTML (article, h1, p tags)
 * - Schema.org microdata attributes
 * - Screen reader accessible (sr-only class)
 *
 * This solves the critical SEO issue where our interactive editor (ContentPageView)
 * is loaded client-side only with ssr: false.
 */

interface PageContent {
  type?: string;
  url?: string; // For image nodes
  alt?: string; // For image alt text
  children?: Array<{
    text?: string;
    type?: string;
    children?: Array<{ text?: string }>;
    url?: string;
    pageTitle?: string;
  }>;
}

interface ServerContentForSEOProps {
  title: string;
  content: PageContent[] | string;
  authorUsername?: string;
  createdAt?: string;
  lastModified?: string;
  pageId: string;
  // Engagement stats (optional - included when available)
  viewCount?: number;
  sponsorCount?: number;
  replyCount?: number;
  // Enhanced SEO props
  tags?: string[];
  category?: string;
}

/**
 * Extract images from Slate.js content
 */
function extractImages(content: PageContent[] | string): Array<{ url: string; alt?: string }> {
  if (!content) return [];

  let parsed: PageContent[];
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }
  } else {
    parsed = content;
  }

  if (!Array.isArray(parsed)) return [];

  const images: Array<{ url: string; alt?: string }> = [];

  function findImages(nodes: any[]) {
    for (const node of nodes) {
      if (node.type === 'image' && node.url) {
        images.push({ url: node.url, alt: node.alt });
      }
      if (node.children && Array.isArray(node.children)) {
        findImages(node.children);
      }
    }
  }

  findImages(parsed);
  return images;
}

/**
 * Extract keywords from title and content
 */
function extractKeywords(title: string, content: string, tags?: string[]): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does',
    'this', 'that', 'it', 'its', 'you', 'your', 'we', 'our', 'they', 'their'
  ]);

  const keywords = new Set<string>();

  // Add tags first (most relevant)
  if (tags) {
    tags.forEach(tag => keywords.add(tag.toLowerCase()));
  }

  // Extract from title
  const titleWords = title.toLowerCase().split(/\s+/).filter(w =>
    w.length > 3 && !stopWords.has(w)
  );
  titleWords.forEach(w => keywords.add(w));

  // Extract from content (first 500 chars)
  const contentWords = content.slice(0, 500).toLowerCase().split(/\s+/).filter(w =>
    w.length > 4 && !stopWords.has(w)
  );
  contentWords.slice(0, 10).forEach(w => keywords.add(w));

  return Array.from(keywords).slice(0, 10);
}

/**
 * Detect FAQ pattern in content and extract Q&A pairs
 * Looks for patterns like "Q:" or "Question:" followed by answers
 * or heading elements that end with "?" followed by paragraph content
 */
function extractFAQItems(content: PageContent[] | string): Array<{ question: string; answer: string }> {
  if (!content) return [];

  let parsed: PageContent[];
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      return [];
    }
  } else {
    parsed = content;
  }

  if (!Array.isArray(parsed)) return [];

  const faqItems: Array<{ question: string; answer: string }> = [];

  // Look for heading-based Q&A patterns (heading with ? followed by paragraph)
  for (let i = 0; i < parsed.length - 1; i++) {
    const node = parsed[i];
    const nodeType = node.type || '';

    // Check if this is a heading
    if (nodeType.includes('heading')) {
      const headingText = node.children?.map(c => c.text || '').join('') || '';

      // Check if heading ends with ? (likely a question)
      if (headingText.trim().endsWith('?')) {
        // Get the next paragraph as the answer
        const nextNode = parsed[i + 1];
        if (nextNode && (!nextNode.type || nextNode.type === 'paragraph')) {
          const answerText = nextNode.children?.map(c => c.text || '').join('') || '';
          if (answerText.length > 20) {
            faqItems.push({
              question: headingText.trim(),
              answer: answerText.slice(0, 500).trim()
            });
          }
        }
      }
    }

    // Also check for "Q:" or "Question:" patterns in paragraph text
    if (!nodeType || nodeType === 'paragraph') {
      const text = node.children?.map(c => c.text || '').join('') || '';

      // Match patterns like "Q: What is..." or "Question: How do..."
      const qMatch = text.match(/^(?:Q:|Question:)\s*(.+\?)\s*$/i);
      if (qMatch && i + 1 < parsed.length) {
        const nextNode = parsed[i + 1];
        const answerText = nextNode?.children?.map(c => c.text || '').join('') || '';

        // Check if answer starts with "A:" or "Answer:"
        const cleanAnswer = answerText.replace(/^(?:A:|Answer:)\s*/i, '').trim();

        if (cleanAnswer.length > 20) {
          faqItems.push({
            question: qMatch[1].trim(),
            answer: cleanAnswer.slice(0, 500)
          });
        }
      }
    }
  }

  return faqItems.slice(0, 10); // Limit to 10 FAQ items
}

/**
 * Extract plain text from Slate.js content structure
 */
function extractPlainText(content: PageContent[] | string): string {
  if (!content) return '';

  // If content is a string, try to parse it
  let parsed: PageContent[];
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      // If it's not JSON, return as-is (plain text)
      return content;
    }
  } else {
    parsed = content;
  }

  if (!Array.isArray(parsed)) return '';

  const textParts: string[] = [];

  for (const node of parsed) {
    if (node.children) {
      const paragraphText = node.children
        .map((child) => {
          if (child.text) {
            return child.text;
          }
          // Handle links - extract their text
          if (child.type === 'link' && child.children) {
            return child.children.map((linkChild) => linkChild.text || '').join('');
          }
          return '';
        })
        .join('');

      if (paragraphText.trim()) {
        textParts.push(paragraphText.trim());
      }
    }
  }

  return textParts.join('\n\n');
}

/**
 * Render content as semantic HTML paragraphs
 */
function renderContentAsHTML(content: PageContent[] | string): React.ReactNode {
  if (!content) return null;

  let parsed: PageContent[];
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      // Plain text - wrap in paragraph
      return <p>{content}</p>;
    }
  } else {
    parsed = content;
  }

  if (!Array.isArray(parsed)) return null;

  return parsed.map((node, index) => {
    if (!node.children) return null;

    const children = node.children.map((child, childIndex) => {
      if (child.text) {
        return <span key={childIndex}>{child.text}</span>;
      }
      // Handle links
      if (child.type === 'link' && child.children) {
        const linkText = child.children.map((linkChild) => linkChild.text || '').join('');
        // Use pageTitle if available, otherwise use the link text
        const displayText = child.pageTitle || linkText;
        return (
          <a
            key={childIndex}
            href={child.url || '#'}
            itemProp="mentions"
          >
            {displayText}
          </a>
        );
      }
      return null;
    });

    // Determine the element type based on node type
    const nodeType = node.type || 'paragraph';

    switch (nodeType) {
      case 'heading-one':
        return <h2 key={index}>{children}</h2>;
      case 'heading-two':
        return <h3 key={index}>{children}</h3>;
      case 'heading-three':
        return <h4 key={index}>{children}</h4>;
      case 'block-quote':
        return <blockquote key={index}>{children}</blockquote>;
      case 'bulleted-list':
        return <ul key={index}>{children}</ul>;
      case 'numbered-list':
        return <ol key={index}>{children}</ol>;
      case 'list-item':
        return <li key={index}>{children}</li>;
      default:
        return <p key={index}>{children}</p>;
    }
  });
}

export default function ServerContentForSEO({
  title,
  content,
  authorUsername,
  createdAt,
  lastModified,
  pageId,
  viewCount,
  sponsorCount,
  replyCount,
  tags,
  category,
}: ServerContentForSEOProps) {
  const plainText = extractPlainText(content);
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const baseUrl = 'https://www.getwewrite.app';
  const images = extractImages(content);
  const keywords = extractKeywords(title, plainText, tags);
  const faqItems = extractFAQItems(content);

  return (
    <article
      className="sr-only"
      itemScope
      itemType="https://schema.org/Article"
      aria-label={`Article: ${title}`}
    >
      {/* Schema.org metadata */}
      <meta itemProp="headline" content={title} />
      <meta itemProp="description" content={plainText.slice(0, 160)} />
      <meta itemProp="wordCount" content={String(wordCount)} />
      <meta itemProp="url" content={`${baseUrl}/${pageId}`} />
      {createdAt && <meta itemProp="datePublished" content={createdAt} />}
      {lastModified && <meta itemProp="dateModified" content={lastModified} />}

      {/* Enhanced SEO: Keywords */}
      {keywords.length > 0 && (
        <meta itemProp="keywords" content={keywords.join(', ')} />
      )}

      {/* Enhanced SEO: Article Section (category) */}
      {category && <meta itemProp="articleSection" content={category} />}

      {/* Enhanced SEO: Images */}
      {images.length > 0 && images.slice(0, 3).map((img, idx) => (
        <div key={idx} itemProp="image" itemScope itemType="https://schema.org/ImageObject">
          <meta itemProp="url" content={img.url} />
          {img.alt && <meta itemProp="description" content={img.alt} />}
        </div>
      ))}

      {/* Author information */}
      {authorUsername && (
        <div itemProp="author" itemScope itemType="https://schema.org/Person">
          <meta itemProp="name" content={authorUsername} />
          <meta itemProp="url" content={`${baseUrl}/u/${authorUsername}`} />
        </div>
      )}

      {/* Publisher */}
      <div itemProp="publisher" itemScope itemType="https://schema.org/Organization">
        <meta itemProp="name" content="WeWrite" />
        <meta itemProp="url" content={baseUrl} />
      </div>

      {/* Breadcrumb Schema for rich snippets */}
      <nav itemScope itemType="https://schema.org/BreadcrumbList" aria-label="Breadcrumb">
        <ol>
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            <a itemProp="item" href={baseUrl}>
              <span itemProp="name">WeWrite</span>
            </a>
            <meta itemProp="position" content="1" />
          </li>
          {authorUsername && (
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <a itemProp="item" href={`${baseUrl}/u/${authorUsername}`}>
                <span itemProp="name">{authorUsername}</span>
              </a>
              <meta itemProp="position" content="2" />
            </li>
          )}
          <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
            <a itemProp="item" href={`${baseUrl}/${pageId}`}>
              <span itemProp="name">{title}</span>
            </a>
            <meta itemProp="position" content={authorUsername ? "3" : "2"} />
          </li>
        </ol>
      </nav>

      {/* Engagement statistics - Schema.org InteractionCounter */}
      {viewCount !== undefined && viewCount > 0 && (
        <div itemProp="interactionStatistic" itemScope itemType="https://schema.org/InteractionCounter">
          <meta itemProp="interactionType" content="https://schema.org/ReadAction" />
          <meta itemProp="userInteractionCount" content={String(viewCount)} />
        </div>
      )}

      {sponsorCount !== undefined && sponsorCount > 0 && (
        <div itemProp="interactionStatistic" itemScope itemType="https://schema.org/InteractionCounter">
          <meta itemProp="interactionType" content="https://schema.org/DonateAction" />
          <meta itemProp="userInteractionCount" content={String(sponsorCount)} />
        </div>
      )}

      {replyCount !== undefined && replyCount > 0 && (
        <>
          <meta itemProp="commentCount" content={String(replyCount)} />
          <div itemProp="interactionStatistic" itemScope itemType="https://schema.org/InteractionCounter">
            <meta itemProp="interactionType" content="https://schema.org/CommentAction" />
            <meta itemProp="userInteractionCount" content={String(replyCount)} />
          </div>
        </>
      )}

      {/* Main content - semantic HTML for crawlers */}
      <header>
        <h1 itemProp="name">{title}</h1>
        {authorUsername && (
          <p>
            By <span itemProp="author">{authorUsername}</span>
          </p>
        )}
      </header>

      <div itemProp="articleBody">
        {renderContentAsHTML(content)}
      </div>

      {/* Plain text fallback for simple crawlers */}
      <noscript>
        <div>
          <h1>{title}</h1>
          {plainText.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </noscript>

      {/* FAQ Schema - appears when Q&A patterns detected in content */}
      {faqItems.length >= 2 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "mainEntity": faqItems.map(item => ({
                "@type": "Question",
                "name": item.question,
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": item.answer
                }
              }))
            })
          }}
        />
      )}
    </article>
  );
}
