import SinglePageView from "../../components/SinglePageView";
import { getPageById } from "../../firebase/database";

export async function generateMetadata({ params }) {
  const { pageData, versionData } = await getPageById(params.id);

  console.log('Raw Page Data:', JSON.stringify(pageData, null, 2));
  console.log('Raw Version Data:', JSON.stringify(versionData, null, 2));

  if (!pageData) {
    console.error('No page data found');
    return {
      title: "Page Not Found",
      description: "This page does not exist"
    };
  }

  // Parse the content from versionData
  let contentText = '';
  try {
    if (!versionData?.content) {
      console.error('No content found in version data');
    } else {
      console.log('Raw content before parsing:', versionData.content);
      
      // Parse content if it's a string, otherwise use it directly
      const parsedContent = typeof versionData.content === 'string' 
        ? JSON.parse(versionData.content)
        : versionData.content;

      console.log('Parsed content structure:', JSON.stringify(parsedContent, null, 2));

      // Try different content structures
      if (Array.isArray(parsedContent)) {
        // If content is a direct array of nodes
        contentText = parsedContent
          .map(node => {
            console.log('Processing array node:', node);
            if (node.text) return node.text;
            if (node.children) {
              return node.children
                .map(child => child.text || '')
                .join('');
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');
      } else if (parsedContent.root?.children) {
        // If content has root.children structure
        contentText = parsedContent.root.children
          .map(node => {
            console.log('Processing root child node:', node);
            if (node.text) return node.text;
            if (node.children) {
              return node.children
                .map(child => child.text || '')
                .join('');
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');
      } else {
        // If content is in a different structure
        console.error('Unrecognized content structure:', parsedContent);
      }
    }

    console.log('Final extracted text:', contentText);
  } catch (e) {
    console.error('Error parsing content:', e);
    console.error('Error stack:', e.stack);
    contentText = '';
  }

  const description = contentText.slice(0, 200) + (contentText.length > 200 ? '...' : '');

  // Get author name from the correct location in user data
  const authorName = pageData.author?.displayName || 'NULL';
  console.log('Author data:', {
    fullAuthorObject: pageData.author,
    finalAuthorName: authorName
  });

  // Base URL for OpenGraph image
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

  // Create OpenGraph image URL with parameters
  const ogImageUrl = new URL('/api/og', baseUrl);
  ogImageUrl.searchParams.set('title', pageData.title);
  
  // Only set content if we actually have content
  if (contentText) {
    ogImageUrl.searchParams.set('content', contentText.slice(0, 200));
  }
  
  ogImageUrl.searchParams.set('author', authorName);

  console.log('Final OpenGraph URL:', ogImageUrl.toString());

  return {
    metadataBase: new URL(baseUrl),
    title: pageData.title,
    description: contentText || 'No description available',
    openGraph: {
      title: pageData.title,
      description: contentText || 'No description available',
      type: 'article',
      url: `${baseUrl}/pages/${params.id}`,
      images: [{
        url: ogImageUrl.toString(),
        width: 1200,
        height: 630,
        alt: pageData.title
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageData.title,
      description: contentText || 'No description available',
      images: [ogImageUrl.toString()],
    },
  };
}

const Page = async ({ params }) => {
  return (
    <SinglePageView params={params} />
  );
};

export default Page;

