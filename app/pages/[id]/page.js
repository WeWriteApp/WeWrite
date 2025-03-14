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
      console.log('Raw content type:', typeof versionData.content);
      console.log('Raw content value:', versionData.content);
      
      let parsedContent;
      try {
        // Handle different content formats
        if (typeof versionData.content === 'string') {
          try {
            parsedContent = JSON.parse(versionData.content);
            console.log('Parsed string content:', parsedContent);
          } catch (e) {
            console.log('Using content directly as string');
            contentText = versionData.content;
            parsedContent = null;
          }
        } else if (typeof versionData.content === 'object') {
          parsedContent = versionData.content;
          console.log('Using content directly as object');
        } else {
          console.error('Content is neither string nor object:', typeof versionData.content);
          contentText = String(versionData.content);
          parsedContent = null;
        }

        if (parsedContent) {
          console.log('Content structure:', {
            isArray: Array.isArray(parsedContent),
            hasRoot: Boolean(parsedContent.root),
            hasChildren: Boolean(parsedContent.children),
            keys: Object.keys(parsedContent)
          });

          // Extract text based on content structure
          if (Array.isArray(parsedContent)) {
            contentText = extractTextFromNodes(parsedContent);
          } else if (parsedContent.root?.children) {
            contentText = extractTextFromNodes(parsedContent.root.children);
          } else if (parsedContent.children) {
            contentText = extractTextFromNodes(parsedContent.children);
          } else if (parsedContent.text) {
            contentText = parsedContent.text;
          } else {
            console.error('Unrecognized content structure');
            contentText = JSON.stringify(parsedContent);
          }
        }
      } catch (parseError) {
        console.error('Error parsing content:', parseError);
        contentText = String(versionData.content);
      }
    }

    console.log('Final extracted text:', contentText);
  } catch (e) {
    console.error('Error processing content:', e);
    console.error('Error stack:', e.stack);
    contentText = '';
  }

  // Base URL for OpenGraph image
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

  // Create OpenGraph image URL with parameters
  const ogImageUrl = new URL('/api/og', baseUrl);
  
  // Always set these parameters
  ogImageUrl.searchParams.set('title', pageData.title || 'Untitled');
  ogImageUrl.searchParams.set('author', pageData.author?.displayName || 'NULL');
  
  // Always set content
  const finalContent = contentText?.trim() || 'No content available';
  ogImageUrl.searchParams.set('content', finalContent);
  console.log('Setting content in URL:', finalContent);

  console.log('Final OpenGraph URL:', ogImageUrl.toString());

  return {
    metadataBase: new URL(baseUrl),
    title: pageData.title || 'Untitled',
    description: contentText.trim() || 'No description available',
    openGraph: {
      title: pageData.title || 'Untitled',
      description: contentText.trim() || 'No description available',
      type: 'article',
      url: `${baseUrl}/pages/${params.id}`,
      images: [{
        url: ogImageUrl.toString(),
        width: 1200,
        height: 630,
        alt: pageData.title || 'Untitled'
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageData.title || 'Untitled',
      description: contentText.trim() || 'No description available',
      images: [ogImageUrl.toString()],
    },
  };
}

// Helper function to extract text from nodes
function extractTextFromNodes(nodes) {
  if (!Array.isArray(nodes)) {
    console.error('Nodes is not an array:', nodes);
    return '';
  }

  return nodes
    .map(node => {
      console.log('Processing node:', JSON.stringify(node));
      
      // If node has direct text
      if (node.text) {
        return node.text;
      }
      
      // If node has children
      if (node.children && Array.isArray(node.children)) {
        return node.children
          .map(child => {
            console.log('Processing child:', JSON.stringify(child));
            if (child.text) return child.text;
            if (child.children) {
              return extractTextFromNodes(child.children);
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');
      }
      
      // If node has type and content
      if (node.type === 'paragraph' && node.content) {
        return node.content;
      }
      
      return '';
    })
    .filter(Boolean)
    .join(' ')
    .trim();
}

const Page = async ({ params }) => {
  return (
    <SinglePageView params={params} />
  );
};

export default Page;

