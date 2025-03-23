import { Metadata, ResolvingMetadata } from 'next';
import { getPageMetadata } from '../../firebase/database';
import { extractTextContent } from '../../utils/generateTextDiff';
import ClientPage from "./client-page";

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
};

// Generate metadata including OpenGraph for each page
export async function generateMetadata(
  { params }: { params: { id: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  // Get the page ID from the params
  const id = params.id;
  
  try {
    // Fetch page metadata from Firebase
    const pageData = await getPageMetadata(id) as PageMetadata | null;
    
    if (!pageData) {
      return {
        title: 'Page Not Found',
        description: 'The requested page could not be found',
      };
    }
    
    // Extract text content for the description
    let description = 'No content available';
    try {
      if (pageData.content) {
        const textContent = extractTextContent(pageData.content);
        description = textContent.substring(0, 200) + (textContent.length > 200 ? '...' : '');
      }
    } catch (error) {
      console.error('Error extracting text content:', error);
    }
    
    // Create OpenGraph metadata
    return {
      title: pageData.title || 'Untitled Page',
      description: description,
      openGraph: {
        title: pageData.title || 'Untitled Page',
        description: description,
        images: [{
          url: `/api/og?id=${id}`,
          width: 1200,
          height: 630,
          alt: pageData.title || 'Untitled Page',
        }],
        type: 'article',
        publishedTime: pageData.createdAt,
        modifiedTime: pageData.lastModified,
        authors: [pageData.username || 'Anonymous'],
      },
      twitter: {
        card: 'summary_large_image',
        title: pageData.title || 'Untitled Page',
        description: description,
        images: [`/api/og?id=${id}`],
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'WeWrite',
      description: 'Write together',
    };
  }
}

export default function Page({ params }: { params: { id: string } }) {
  return <ClientPage params={params} />;
}