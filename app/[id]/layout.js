import { Metadata } from 'next';
import { getPageMetadata } from '../firebase/database';
import Script from 'next/script';

export async function generateMetadata({ params }) {
  try {
    // Await params before accessing properties as required by Next.js
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const metadata = await getPageMetadata(id);

    if (metadata) {
      // Format: "[pagename] by [username] on WeWrite"
      const pageTitle = metadata.title || 'Untitled';
      const username = metadata.username || 'Anonymous';
      const formattedTitle = `${pageTitle} by ${username} on WeWrite`;

      // Use the extracted description from the first paragraph, or a default
      const description = metadata.description ||
        'Create, collaborate, and share your writing with others on WeWrite - the social wiki where every page is a fundraiser.';

      return {
        title: formattedTitle,
        description: description,
        openGraph: {
          title: formattedTitle,
          description: description,
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/${id}`,
          siteName: 'WeWrite',
          type: 'article',
        },
        twitter: {
          card: 'summary_large_image',
          title: formattedTitle,
          description: description,
        }
      };
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  return {
    title: 'WeWrite - The social wiki where every page is a fundraiser',
    description: 'Create, collaborate, and share your writing with others on WeWrite - the social wiki where every page is a fundraiser.',
  };
}

export default async function GlobalIDLayout({ children, params }) {
  // Get the page metadata for schema markup
  let schemaMarkup = null;

  try {
    const id = params.id;
    const metadata = await getPageMetadata(id);

    if (metadata) {
      // Create schema markup for the page
      const pageTitle = metadata.title || 'Untitled';
      const username = metadata.username || 'Anonymous';
      const description = metadata.description || '';
      const datePublished = metadata.createdAt || new Date().toISOString();
      const dateModified = metadata.lastModified || datePublished;

      // Generate schema markup
      schemaMarkup = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: pageTitle,
        description: description,
        author: {
          '@type': 'Person',
          name: username
        },
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
