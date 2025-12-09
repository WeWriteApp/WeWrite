import Script from 'next/script';
import type { Metadata } from 'next';

// Type definitions
interface PageParams {
  id: string;
}

interface GenerateMetadataProps {
  params: Promise<PageParams>;
}

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<PageParams>;
}

interface SchemaMarkup {
  '@context': string;
  '@type': string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  publisher: {
    '@type': string;
    name: string;
    logo?: {
      '@type': string;
      url: string;
    };
    parentOrganization?: {
      '@type': string;
      name: string;
      logo: {
        '@type': string;
        url: string;
      };
    };
  };
  mainEntityOfPage: {
    '@type': string;
    '@id': string;
  };
  author?: {
    '@type': string;
    name: string;
  };
}

// Server-side page metadata fetching using internal API
// This ensures usernames are correctly fetched from RTDB
async function getPageMetadataServer(pageId: string): Promise<any> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                   (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                   (process.env.NODE_ENV === 'production' ? 'https://www.getwewrite.app' : 'http://localhost:3000'));

    const response = await fetch(`${baseUrl}/api/pages/${pageId}`, {
      cache: 'no-store', // Don't cache to always get fresh data
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`Page metadata fetch failed for ${pageId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    // Extract pageData from the response wrapper
    return data.pageData || data;
  } catch (error) {
    console.error('Error fetching page metadata from API:', error);
    return null;
  }
}

export async function generateMetadata({ params }: GenerateMetadataProps): Promise<Metadata> {
  try {
    // Properly extract id from params - ensure params is awaited
    const unwrappedParams = await params;
    const { id } = unwrappedParams;
    // Use server-side API fetch to get page metadata with correct username from RTDB
    const metadata = await getPageMetadataServer(id);

    if (metadata) {
      // Get page title
      const pageTitle = metadata.title || 'Untitled';
      let formattedTitle: string;

      // Format title based on whether the page belongs to a group
      if (metadata.groupId && metadata.groupName) {
        // Format: "[pagename] in [groupName] on WeWrite"
        formattedTitle = `${pageTitle} in ${metadata.groupName} on WeWrite`;
      } else {
        // Format: "[pagename] by [username] on WeWrite"
        const username = metadata.username || 'Anonymous';
        formattedTitle = `${pageTitle} by ${username} on WeWrite`;
      }

      // Use the extracted description from the first paragraph, or a default
      const description = metadata.description ||
        'Create, collaborate, and share your writing with others on WeWrite - the social wiki where every page is a fundraiser.';

      // Get base URL with fallback for different environments
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                     (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.getwewrite.app');

      const canonicalUrl = `${baseUrl}/${id}`;
      const imageUrl = `${baseUrl}/api/og?id=${id}`;

      return {
        title: formattedTitle,
        description: description,
        keywords: metadata.tags ? metadata.tags.join(', ') : 'writing, collaboration, social wiki, fundraising',
        authors: [{ name: metadata.username || 'Anonymous' }],
        creator: metadata.username || 'Anonymous',
        publisher: 'WeWrite',
        alternates: {
          canonical: canonicalUrl
        },
        robots: {
          index: metadata.isPublic !== false,
          follow: true,
          googleBot: {
            index: metadata.isPublic !== false,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1
          }
        },
        openGraph: {
          title: formattedTitle,
          description: description,
          url: canonicalUrl,
          siteName: 'WeWrite',
          type: 'article',
          publishedTime: metadata.createdAt,
          modifiedTime: metadata.lastModified,
          authors: [metadata.username || 'Anonymous'],
          images: [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: formattedTitle
            }
          ]
        },
        twitter: {
          card: 'summary_large_image',
          title: formattedTitle,
          description: description,
          images: [imageUrl],
          creator: metadata.username ? `@${metadata.username}` : undefined
        }
      };
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  // Fallback metadata - still include the page ID for OG image
  const unwrappedParams = await params;
  const pageId = unwrappedParams.id;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                 (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.getwewrite.app');

  return {
    title: 'WeWrite - The social wiki where every page is a fundraiser',
    description: 'Create, collaborate, and share your writing with others on WeWrite - the social wiki where every page is a fundraiser.',
    openGraph: {
      title: 'WeWrite - The social wiki where every page is a fundraiser',
      description: 'Create, collaborate, and share your writing with others on WeWrite - the social wiki where every page is a fundraiser.',
      url: `${baseUrl}/${pageId}`,
      siteName: 'WeWrite',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'WeWrite - The social wiki where every page is a fundraiser',
      description: 'Create, collaborate, and share your writing with others on WeWrite - the social wiki where every page is a fundraiser.',
    }
  };
}

export default async function GlobalIDLayout({ children, params }: LayoutProps) {
  // Get the page metadata for schema markup
  let schemaMarkup: SchemaMarkup | null = null;

  try {
    // Properly extract id from params - ensure params is awaited
    const unwrappedParams = await params;
    const { id } = unwrappedParams;
    // Use server-side API fetch to get page metadata with correct username from RTDB
    const metadata = await getPageMetadataServer(id);

    if (metadata) {
      // Create schema markup for the page
      const pageTitle = metadata.title || 'Untitled';
      const description = metadata.description || '';
      const datePublished = metadata.createdAt || new Date().toISOString();
      const dateModified = metadata.lastModified || datePublished;

      // Generate schema markup
      schemaMarkup = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: pageTitle,
        description: description,
        datePublished: datePublished,
        dateModified: dateModified,
        publisher: {
          '@type': 'Organization',
          name: 'WeWrite',
          logo: {
            '@type': 'ImageObject',
            url: `${process.env.NEXT_PUBLIC_BASE_URL}/logo.png`
          }
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${process.env.NEXT_PUBLIC_BASE_URL}/${id}`
        }
      };

      // Add author or group information based on whether the page belongs to a group
      if (metadata.groupId && metadata.groupName) {
        // For group pages, add the group as the publisher
        schemaMarkup.publisher = {
          '@type': 'Organization',
          name: metadata.groupName,
          parentOrganization: {
            '@type': 'Organization',
            name: 'WeWrite',
            logo: {
              '@type': 'ImageObject',
              url: `${process.env.NEXT_PUBLIC_BASE_URL}/logo.png`
            }
          }
        };
      } else {
        // For regular pages, add the author
        const username = metadata.username || 'Anonymous';
        schemaMarkup.author = {
          '@type': 'Person',
          name: username
        };
      }
    }
  } catch (error) {
    console.error('Error generating schema markup:', error);
  }

  return (
    <>
      {schemaMarkup && (
        <Script
          id="schema-markup"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
        />
      )}
      {children}
    </>
  );
}