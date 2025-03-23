import { Metadata, ResolvingMetadata } from 'next';
import { getPageMetadata } from '../../firebase/database';
import { createPageDescription } from '../../../utils/textExtraction';
import ClientPage from './client-page';

// Define type for the page metadata
type PageMetadata = {
  id: string;
  title?: string;
  username?: string;
  content?: any;
  userId?: string;
  createdAt?: string;
  lastModified?: string;
  isPublic?: boolean;
  description?: string;
};

// Generate metadata including OpenGraph for each page
export async function generateMetadata(
  { params }: { params: { id: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  // Get page metadata from Firestore
  const metadata = await getPageMetadata(params.id) as PageMetadata | null;
  
  // If page not found, return default metadata
  if (!metadata) {
    return {
      title: 'Page Not Found',
      description: 'This page could not be found.',
    };
  }

  // Generate a good description using our utility
  const description = createPageDescription(metadata);
  
  // Instead of constructing a dynamic URL, use a relative path
  // This avoids static build errors with request.url in the API
  const imageUrl = `/api/og?id=${params.id}`;
  
  return {
    title: metadata.title || 'Untitled Page',
    description,
    openGraph: {
      title: metadata.title || 'Untitled Page',
      description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: metadata.title || 'WeWrite Page',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: metadata.title || 'Untitled Page',
      description,
      images: [imageUrl],
    },
  };
}

export default function Page({ params }: { params: { id: string } }) {
  return <ClientPage params={params} />;
}