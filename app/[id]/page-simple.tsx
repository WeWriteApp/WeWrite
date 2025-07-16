"use client";

import { useEffect, useState } from 'react';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';
import { getPageById } from '../firebase/database/pages';

interface PageData {
  id: string;
  title: string;
  content: any[];
  userId: string;
  username?: string;
  isPublic: boolean;
  createdAt: any;
  updatedAt: any;
}

interface PageComponentProps {
  params: Promise<{ id: string }> | { id: string };
}

export default function PageComponent({ params }: PageComponentProps) {
  const { currentAccount, isLoading: authLoading } = useCurrentAccount();
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string>('');

  // Extract page ID from params
  useEffect(() => {
    async function extractId() {
      try {
        let unwrappedParams;
        if (params && typeof (params as any).then === 'function') {
          unwrappedParams = await (params as Promise<{ id: string }>);
        } else {
          unwrappedParams = (params as { id: string }) || {};
        }
        
        let extractedId = unwrappedParams.id || '';
        
        // Clean up the ID (remove encoded slashes, etc.)
        if (extractedId.includes('%2F')) {
          extractedId = decodeURIComponent(extractedId);
        }
        if (extractedId.includes('/')) {
          extractedId = extractedId.split('/')[0];
        }
        
        console.log('📄 PageComponent: Extracted ID:', extractedId);
        setPageId(extractedId);
      } catch (error) {
        console.error('📄 PageComponent: Error extracting ID:', error);
        setError('Invalid page URL');
        setIsLoading(false);
      }
    }
    
    extractId();
  }, [params]);

  // Fetch page data
  useEffect(() => {
    if (!pageId || authLoading) return;

    async function fetchPage() {
      console.log('📄 PageComponent: Fetching page data for:', pageId);
      setIsLoading(true);
      setError(null);

      try {
        const result = await getPageById(pageId, currentAccount?.uid);
        
        if (result.error) {
          console.log('📄 PageComponent: Error fetching page:', result.error);
          setError(result.error);
        } else if (result.pageData) {
          console.log('📄 PageComponent: Successfully fetched page:', result.pageData.title);
          setPageData(result.pageData);
        } else {
          console.log('📄 PageComponent: No page data returned');
          setError('Page not found');
        }
      } catch (error) {
        console.error('📄 PageComponent: Fetch error:', error);
        setError('Failed to load page');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPage();
  }, [pageId, currentAccount?.uid, authLoading]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading page...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // No page data
  if (!pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
          <p className="text-muted-foreground">This page doesn't exist or you don't have permission to view it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">{pageData.title}</h1>
          <p className="text-muted-foreground mt-2">
            by {pageData.username || 'Unknown'} • {pageData.isPublic ? 'Public' : 'Private'}
          </p>
        </div>
      </header>

      {/* Simple Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <SimpleContent content={pageData.content} />
        </div>
      </main>
    </div>
  );
}

// Simple content renderer - no complex parsing, just render what we get
function SimpleContent({ content }: { content: any }) {
  console.log('📄 SimpleContent: Rendering content:', content);

  if (!content) {
    return (
      <div className="text-muted-foreground italic">
        This page has no content yet.
      </div>
    );
  }

  // If content is a string, try to parse it
  let parsedContent = content;
  if (typeof content === 'string') {
    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      console.error('📄 SimpleContent: Failed to parse content string:', error);
      return (
        <div className="text-muted-foreground">
          Unable to display content. Content format error.
        </div>
      );
    }
  }

  // If content is not an array, wrap it
  if (!Array.isArray(parsedContent)) {
    parsedContent = [parsedContent];
  }

  return (
    <div className="prose prose-lg max-w-none">
      {parsedContent.map((node: any, index: number) => (
        <SimpleNode key={index} node={node} />
      ))}
    </div>
  );
}

// Simple node renderer - handle basic types only
function SimpleNode({ node }: { node: any }) {
  if (!node || typeof node !== 'object') {
    return <span>{String(node)}</span>;
  }

  const { type, children } = node;

  // Render children if they exist
  const renderChildren = () => {
    if (!children || !Array.isArray(children)) return null;
    return children.map((child: any, index: number) => (
      <SimpleNode key={index} node={child} />
    ));
  };

  // Handle different node types
  switch (type) {
    case 'heading':
      const level = node.level || 1;
      const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
      return <HeadingTag>{renderChildren()}</HeadingTag>;
      
    case 'paragraph':
      return <p>{renderChildren()}</p>;
      
    case 'text':
      return <span>{node.text}</span>;
      
    case 'link':
      return <a href={node.url} className="text-primary hover:underline">{renderChildren()}</a>;
      
    case 'bold':
      return <strong>{renderChildren()}</strong>;
      
    case 'italic':
      return <em>{renderChildren()}</em>;
      
    default:
      // For unknown types, just render children or text
      if (node.text) {
        return <span>{node.text}</span>;
      }
      return <div>{renderChildren()}</div>;
  }
}
