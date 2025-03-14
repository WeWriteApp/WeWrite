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
      console.log('Version data:', versionData);
    } else {
      console.log('Raw content type:', typeof versionData.content);
      console.log('Raw content value:', versionData.content);
      
      let parsedContent;
      try {
        // Handle different content formats
        if (typeof versionData.content === 'string') {
          try {
            parsedContent = JSON.parse(versionData.content);
            console.log('Successfully parsed content as JSON:', parsedContent);
          } catch (e) {
            console.log('Content is not JSON, using as plain text');
            contentText = versionData.content;
            parsedContent = null;
          }
        } else if (typeof versionData.content === 'object') {
          parsedContent = versionData.content;
          console.log('Content is already an object');
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
          } else if (typeof parsedContent === 'string') {
            contentText = parsedContent;
          } else {
            // Try to extract text from the object itself
            contentText = extractTextFromObject(parsedContent);
          }
        }
      } catch (parseError) {
        console.error('Error parsing content:', parseError);
        console.error('Parse error stack:', parseError.stack);
        // If all else fails, try to use the content directly
        contentText = String(versionData.content);
      }
    }

    console.log('Extracted content text:', {
      text: contentText,
      length: contentText?.length,
      type: typeof contentText
    });
  } catch (e) {
    console.error('Error processing content:', e);
    console.error('Error stack:', e.stack);
    contentText = '';
  }

  // Base URL for OpenGraph image
  const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL 
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

  // Prepare parameters - ensure they're clean and properly formatted
  const title = (pageData.title?.trim() || 'Untitled').replace(/[^\w\s-]/g, '');
  const author = ((pageData.author?.displayName && pageData.author.displayName !== 'NULL') 
    ? pageData.author.displayName.trim() 
    : 'Anonymous').replace(/[^\w\s-]/g, '');
  const content = (contentText?.trim() || '')
    .slice(0, 100)
    .replace(/[^\w\s-]/g, '');

  // Create URL-safe parameters
  const safeTitle = encodeURIComponent(title).replace(/%20/g, '-');
  const safeAuthor = encodeURIComponent(author).replace(/%20/g, '-');
  const safeContent = encodeURIComponent(content).replace(/%20/g, '-');

  // Construct the OpenGraph image URL
  const ogImageUrl = `${baseUrl}/api/og/${safeTitle}/${safeAuthor}/${safeContent}`;

  console.log('OpenGraph generation:', {
    baseUrl,
    rawTitle: title,
    rawAuthor: author,
    rawContent: content,
    safeTitle,
    safeAuthor,
    safeContent,
    finalUrl: ogImageUrl
  });

  // Create metadata with absolute URLs
  const metadata = {
    metadataBase: new URL(baseUrl),
    title,
    description: content || 'No description available',
    openGraph: {
      title,
      description: content || 'No description available',
      type: 'article',
      url: `${baseUrl}/pages/${params.id}`,
      images: [{
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: content || 'No description available',
      images: [ogImageUrl],
    },
  };

  console.log('Generated metadata:', JSON.stringify(metadata, null, 2));

  return metadata;
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

// Helper function to extract text from an object
function extractTextFromObject(obj) {
  if (!obj) return '';
  
  // If it's a string, return it
  if (typeof obj === 'string') return obj;
  
  // If it's an array, process each element
  if (Array.isArray(obj)) {
    return obj.map(item => extractTextFromObject(item)).filter(Boolean).join(' ');
  }
  
  // If it's an object, look for common text properties
  if (typeof obj === 'object') {
    // Common properties that might contain text
    const textProps = ['text', 'content', 'value', 'description'];
    for (const prop of textProps) {
      if (obj[prop] && typeof obj[prop] === 'string') {
        return obj[prop];
      }
    }
    
    // If no text properties found, try all string values
    return Object.values(obj)
      .map(value => extractTextFromObject(value))
      .filter(Boolean)
      .join(' ');
  }
  
  return '';
}

const Page = async ({ params }) => {
  return (
    <SinglePageView params={params} />
  );
};

export default Page;

