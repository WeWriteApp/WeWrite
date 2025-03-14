import SinglePageView from "../../components/SinglePageView";
import { getPageById } from "../../firebase/database";

export async function generateMetadata({ params }) {
  const { pageData, versionData } = await getPageById(params.id);

  console.log('Page Data:', pageData);
  console.log('Version Data:', versionData);

  if (!pageData) {
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
      // Parse content if it's a string, otherwise use it directly
      const parsedContent = typeof versionData.content === 'string' 
        ? JSON.parse(versionData.content)
        : versionData.content;

      console.log('Parsed content:', parsedContent);

      if (parsedContent?.root?.children) {
        contentText = parsedContent.root.children
          .map(node => {
            if (!node?.children) return '';
            return node.children
              .map(child => {
                console.log('Processing child node:', child);
                return child?.text || '';
              })
              .join('');
          })
          .filter(text => text) // Remove empty strings
          .join(' ');
      }
    }

    console.log('Extracted text:', contentText);
  } catch (e) {
    console.error('Error parsing content:', e);
    contentText = '';
  }

  const description = contentText.slice(0, 200) + (contentText.length > 200 ? '...' : '');

  // Base URL for OpenGraph image
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

  // Create OpenGraph image URL with parameters
  const ogImageUrl = new URL('/api/og', baseUrl);
  ogImageUrl.searchParams.set('title', pageData.title);
  
  // Only set content if we actually have content
  if (contentText) {
    ogImageUrl.searchParams.set('content', contentText);
  }
  
  // Get author name from the correct location in user data
  const authorName = pageData.author?.displayName || 'NULL';
  console.log('Author name:', authorName);
  ogImageUrl.searchParams.set('author', authorName);

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

