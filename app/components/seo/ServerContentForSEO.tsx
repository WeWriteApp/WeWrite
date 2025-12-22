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
}: ServerContentForSEOProps) {
  const plainText = extractPlainText(content);
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const baseUrl = 'https://www.getwewrite.app';

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
    </article>
  );
}
