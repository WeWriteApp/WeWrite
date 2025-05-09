import { Metadata } from 'next';
import { getPageMetadata } from '../firebase/database';

export async function generateMetadata({ params }) {
  try {
    const id = params.id;
    const metadata = await getPageMetadata(id);

    if (metadata) {
      // Format: "[pagename] by [username] on WeWrite - The social wiki where every page is a fundraiser"
      const pageTitle = metadata.title || 'Untitled';
      const username = metadata.username || 'Anonymous';
      const formattedTitle = `${pageTitle} by ${username} on WeWrite - The social wiki where every page is a fundraiser`;

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

export default function GlobalIDLayout({ children }) {
  return children;
}
