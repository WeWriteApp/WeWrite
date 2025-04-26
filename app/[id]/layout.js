import { getPageMetadata } from '../firebase/database';

export async function generateMetadata({ params }) {
  try {
    const id = params.id;
    const metadata = await getPageMetadata(id);

    if (metadata) {
      return {
        title: metadata.title || 'WeWrite',
        description: metadata.description || 'A collaborative writing platform',
        openGraph: {
          title: metadata.title || 'WeWrite',
          description: metadata.description || 'A collaborative writing platform',
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/${id}`,
          siteName: 'WeWrite',
          type: 'article',
        },
        twitter: {
          card: 'summary_large_image',
          title: metadata.title || 'WeWrite',
          description: metadata.description || 'A collaborative writing platform',
        }
      };
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  return {
    title: 'WeWrite',
    description: 'A collaborative writing platform',
  };
}

export default function GlobalIDLayout({ children }) {
  return children;
}
