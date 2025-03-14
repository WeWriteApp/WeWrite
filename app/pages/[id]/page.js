import SinglePageView from "../../components/SinglePageView";
import { getPageById } from "../../firebase/database";

export async function generateMetadata({ params }) {
  const { pageData, versionData } = await getPageById(params.id);

  if (!pageData) {
    return {
      title: "Page Not Found",
      description: "This page does not exist"
    };
  }

  // Get the first 200 characters of content for the description
  const contentText = versionData?.content?.root?.children
    ?.map(node => node?.children?.map(child => child?.text || '').join('') || '')
    .join(' ') || '';
  const description = contentText.slice(0, 200) + (contentText.length > 200 ? '...' : '');

  // Base URL for OpenGraph image
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

  // Create OpenGraph image URL with parameters
  const ogImageUrl = new URL('/api/og', baseUrl);
  ogImageUrl.searchParams.set('title', pageData.title);
  ogImageUrl.searchParams.set('content', contentText);
  ogImageUrl.searchParams.set('author', pageData.author?.name || pageData.author?.email || 'Anonymous');

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

