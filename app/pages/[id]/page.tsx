import { Metadata, ResolvingMetadata } from 'next';
import { getPageMetadata } from '../../firebase/database';
import { extractTextContent } from '../../utils/generateTextDiff';
import ClientPage from './client-page';

// Define type for the page metadata
type PageMetadata = {
  id: string;
  title?: string;
  content?: string;
  userId?: string;
  username?: string;
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

  // Constructing the absolute URL
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';
    
  // Use a static fallback image for now until the dynamic OG generation is fixed
  const imageUrl = `${baseUrl}/opengraph-image.png`;
  
  return {
    title: metadata.title || 'Untitled Page',
    description: metadata.description || `A WeWrite page by ${metadata.username || 'Anonymous'}`,
    openGraph: {
      title: metadata.title || 'Untitled Page',
      description: metadata.description || `A WeWrite page by ${metadata.username || 'Anonymous'}`,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: metadata.title || 'Untitled Page',
      description: metadata.description || `A WeWrite page by ${metadata.username || 'Anonymous'}`,
      images: [imageUrl],
    },
  };
}

export default function Page({ params }: { params: { id: string } }) {
  return <ClientPage params={params} />;
}