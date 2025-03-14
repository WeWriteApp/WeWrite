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
    // Check if content is already a string or needs parsing
    const content = typeof versionData?.content === 'string' 
      ? JSON.parse(versionData.content)
      : versionData?.content || { root: { children: [] } };

    console.log('Parsed content:', content);

    contentText = content?.root?.children
      ?.map(node => {
        console.log('Node:', node);
        return node?.children?.map(child => child?.text || '').join('') || '';
      })
      .join(' ') || '';

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
  ogImageUrl.searchParams.set('content', contentText || description || 'No content available');
  
  // Get author name from the correct location in user data
  const authorName = pageData.author?.displayName || pageData.author?.name || 'NULL';
  console.log('Author name:', authorName);
  ogImageUrl.searchParams.set('author', authorName);

  return {
    metadataBase: new URL(baseUrl),
    title: pageData.title,
    description,
    openGraph: {
      title: pageData.title,
      description,
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
      description,
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

