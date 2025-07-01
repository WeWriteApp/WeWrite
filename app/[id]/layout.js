import { getPageMetadata } from "../firebase/database";
import Script from 'next/script';

export async function generateMetadata({ params }) {
  try {
    // Properly extract id from params - ensure params is awaited
    const unwrappedParams = await params;
    const { id } = unwrappedParams;
    const metadata = await getPageMetadata(id);

    if (metadata) {
      // Get page title
      const pageTitle = metadata.title || 'Untitled';
      let formattedTitle;

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

      const canonicalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/${id}`;
      const imageUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/og?id=${id}`;

      return {
        title: formattedTitle,
        description: description,
        keywords: metadata.tags ? metadata.tags.join(', ') : 'writing, collaboration, social wiki, fundraising',
        authors: [{ name: metadata.username || 'Anonymous' }],
        creator: metadata.username || 'Anonymous',
        publisher: 'WeWrite',
        alternates: {
          canonical: canonicalUrl},
        robots: {
          index: metadata.isPublic !== false,
          follow: true,
          googleBot: {
            index: metadata.isPublic !== false,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1}},
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
              alt: formattedTitle}
          ]},
        twitter: {
          card: 'summary_large_image',
          title: formattedTitle,
          description: description,
          images: [imageUrl],
          creator: metadata.username ? `@${metadata.username}` : undefined}
      };
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  return {
    title: 'WeWrite - The social wiki where every page is a fundraiser',
    description: 'Create, collaborate, and share your writing with others on WeWrite - the social wiki where every page is a fundraiser.'};
}

export default async function GlobalIDLayout({ children, params }) {
  // Get the page metadata for schema markup
  let schemaMarkup = null;

  try {
    // Properly extract id from params - ensure params is awaited
    const unwrappedParams = await params;
    const { id } = unwrappedParams;
    const metadata = await getPageMetadata(id);

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