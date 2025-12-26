"use client";

import React, { useState, useCallback, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../providers/AuthProvider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

// Sample content for preview
const SAMPLE_CONTENT = {
  title: "The Future of Sustainable Technology",
  author: "jamie",
  authorDisplayName: "Jamie Gray",
  date: "December 26, 2024",
  content: `
    <p>As we look toward the future, sustainable technology stands at the forefront of innovation. The intersection of environmental consciousness and technological advancement has created unprecedented opportunities for positive change.</p>

    <h2>The Rise of Green Computing</h2>
    <p>Data centers around the world are increasingly turning to renewable energy sources. Companies like Google and Microsoft have committed to carbon-neutral operations, setting a precedent for the entire industry.</p>

    <blockquote>
      "The best way to predict the future is to create it." - Peter Drucker
    </blockquote>

    <h2>Key Innovations</h2>
    <p>Several breakthrough technologies are driving this sustainable revolution:</p>
    <ul>
      <li>Advanced solar cell efficiency reaching 47% conversion rates</li>
      <li>Solid-state batteries with improved energy density</li>
      <li>AI-powered grid optimization systems</li>
      <li>Biodegradable electronics and e-waste reduction</li>
    </ul>

    <h3>The Role of AI</h3>
    <p>Artificial intelligence plays a crucial role in optimizing resource usage. Machine learning algorithms can predict energy consumption patterns and automatically adjust systems for maximum efficiency.</p>

    <p>This represents not just a technological shift, but a fundamental change in how we approach the relationship between innovation and environmental stewardship. The companies that embrace this philosophy will likely lead the next generation of technological advancement.</p>

    <h2>Looking Forward</h2>
    <p>The path ahead is clear: sustainable technology is no longer optional but essential. As consumers become more environmentally conscious and regulations tighten, businesses must adapt or risk obsolescence.</p>
  `,
  sponsors: 12,
  views: 1423,
};

interface PrintSettings {
  showHeader: boolean;
  showMeta: boolean;
  showFooter: boolean;
  showUrls: boolean;
  fontSize: 'small' | 'medium' | 'large';
  paperSize: 'letter' | 'a4';
  margins: 'narrow' | 'normal' | 'wide';
}

export default function PrintPreviewPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const previewRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<PrintSettings>({
    showHeader: true,
    showMeta: true,
    showFooter: true,
    showUrls: false,
    fontSize: 'medium',
    paperSize: 'letter',
    margins: 'normal',
  });

  const [lookupPageId, setLookupPageId] = useState('');
  const [pageData, setPageData] = useState<any>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Check if user is admin
  React.useEffect(() => {
    if (!authLoading && user) {
      if (!user.isAdmin) {
        router.push('/');
      }
    } else if (!authLoading && !user) {
      router.push('/auth/login?redirect=/admin/print-preview');
    }
  }, [user, authLoading, router]);

  const handleLookupPage = useCallback(async () => {
    if (!lookupPageId.trim()) {
      setPageData(null);
      return;
    }

    setIsLookingUp(true);
    try {
      const response = await fetch(`/api/pages/${encodeURIComponent(lookupPageId)}`);
      if (response.ok) {
        const data = await response.json();
        setPageData(data);
      } else {
        setPageData(null);
      }
    } catch (error) {
      console.error('Error looking up page:', error);
      setPageData(null);
    } finally {
      setIsLookingUp(false);
    }
  }, [lookupPageId]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const displayData = pageData || SAMPLE_CONTENT;

  // Extract plain text from rich content if needed
  const getContentHtml = useCallback((content: any): string => {
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return parsed.map((node: any) => {
            if (node.type === 'paragraph') {
              const text = node.children?.map((c: any) => c.text || '').join('') || '';
              return `<p>${text}</p>`;
            }
            if (node.type === 'heading-one' || node.type === 'h1') {
              const text = node.children?.map((c: any) => c.text || '').join('') || '';
              return `<h2>${text}</h2>`;
            }
            if (node.type === 'heading-two' || node.type === 'h2') {
              const text = node.children?.map((c: any) => c.text || '').join('') || '';
              return `<h3>${text}</h3>`;
            }
            if (node.type === 'blockquote') {
              const text = node.children?.map((c: any) => c.text || '').join('') || '';
              return `<blockquote>${text}</blockquote>`;
            }
            if (node.type === 'bulleted-list' || node.type === 'ul') {
              const items = node.children?.map((item: any) => {
                const text = item.children?.map((c: any) => c.text || '').join('') || '';
                return `<li>${text}</li>`;
              }).join('') || '';
              return `<ul>${items}</ul>`;
            }
            return '';
          }).join('');
        }
      } catch {
        // Not JSON, return as-is
      }
    }
    return content || SAMPLE_CONTENT.content;
  }, []);

  const fontSizeClass = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  }[settings.fontSize];

  const marginClass = {
    narrow: 'px-4',
    normal: 'px-8',
    wide: 'px-16',
  }[settings.margins];

  const paperClass = {
    letter: 'max-w-[8.5in] aspect-[8.5/11]',
    a4: 'max-w-[210mm] aspect-[210/297]',
  }[settings.paperSize];

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Icon name="Loader" className="text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Access denied</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="py-6 px-4 container mx-auto max-w-7xl">
        {/* Desktop Header - hidden on mobile (drawer handles navigation) */}
        <div className="hidden lg:flex mb-6 items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Print Preview</h1>
            <p className="text-muted-foreground text-sm">
              Customize how pages look when printed
            </p>
          </div>
          <Button onClick={handlePrint} className="gap-2">
            <Icon name="Printer" size={16} />
            Print
          </Button>
        </div>

        <div className="pt-24 lg:pt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Settings Panel */}
            <div className="lg:col-span-1 space-y-4">
              {/* Page Lookup */}
              <div className="wewrite-card">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="Search" size={20} className="text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Look Up Page</h3>
                </div>

                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Enter page ID..."
                    value={lookupPageId}
                    onChange={(e) => setLookupPageId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLookupPage()}
                    className="flex-1 px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button
                    onClick={handleLookupPage}
                    disabled={!lookupPageId.trim() || isLookingUp}
                    size="sm"
                  >
                    {isLookingUp ? (
                      <Icon name="Loader" size={16} />
                    ) : (
                      <Icon name="Search" size={16} />
                    )}
                  </Button>
                </div>

                {pageData && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium text-sm truncate">{pageData.title}</div>
                    <div className="text-xs text-muted-foreground">by {pageData.authorUsername || pageData.username}</div>
                  </div>
                )}

                {!pageData && (
                  <p className="text-xs text-muted-foreground">
                    Using sample content. Enter a page ID to preview a real page.
                  </p>
                )}
              </div>

              {/* Print Settings */}
              <div className="wewrite-card">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="Settings" size={20} className="text-muted-foreground" />
                  <h3 className="text-lg font-semibold">Print Settings</h3>
                </div>

                <div className="space-y-4">
                  {/* Toggles */}
                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Show Header</span>
                      <input
                        type="checkbox"
                        checked={settings.showHeader}
                        onChange={(e) => setSettings(s => ({ ...s, showHeader: e.target.checked }))}
                        className="w-4 h-4 rounded border-border"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Show Meta Info</span>
                      <input
                        type="checkbox"
                        checked={settings.showMeta}
                        onChange={(e) => setSettings(s => ({ ...s, showMeta: e.target.checked }))}
                        className="w-4 h-4 rounded border-border"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Show Footer</span>
                      <input
                        type="checkbox"
                        checked={settings.showFooter}
                        onChange={(e) => setSettings(s => ({ ...s, showFooter: e.target.checked }))}
                        className="w-4 h-4 rounded border-border"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Show Link URLs</span>
                      <input
                        type="checkbox"
                        checked={settings.showUrls}
                        onChange={(e) => setSettings(s => ({ ...s, showUrls: e.target.checked }))}
                        className="w-4 h-4 rounded border-border"
                      />
                    </label>
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Font Size</label>
                    <div className="flex gap-2">
                      {(['small', 'medium', 'large'] as const).map((size) => (
                        <Button
                          key={size}
                          variant={settings.fontSize === size ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSettings(s => ({ ...s, fontSize: size }))}
                          className="flex-1 capitalize"
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Paper Size */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Paper Size</label>
                    <div className="flex gap-2">
                      <Button
                        variant={settings.paperSize === 'letter' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSettings(s => ({ ...s, paperSize: 'letter' }))}
                        className="flex-1"
                      >
                        US Letter
                      </Button>
                      <Button
                        variant={settings.paperSize === 'a4' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSettings(s => ({ ...s, paperSize: 'a4' }))}
                        className="flex-1"
                      >
                        A4
                      </Button>
                    </div>
                  </div>

                  {/* Margins */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Margins</label>
                    <div className="flex gap-2">
                      {(['narrow', 'normal', 'wide'] as const).map((margin) => (
                        <Button
                          key={margin}
                          variant={settings.margins === margin ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSettings(s => ({ ...s, margins: margin }))}
                          className="flex-1 capitalize"
                        >
                          {margin}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Print Button */}
              <div className="lg:hidden">
                <Button onClick={handlePrint} className="w-full gap-2">
                  <Icon name="Printer" size={16} />
                  Print This Page
                </Button>
              </div>

              {/* Print Tips */}
              <div className="wewrite-card bg-muted/30">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Icon name="Lightbulb" size={16} className="text-yellow-500" />
                  Print Tips
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Use browser's print dialog for final adjustments</li>
                  <li>• Enable "Background graphics" for any visual elements</li>
                  <li>• "Save as PDF" works for digital distribution</li>
                  <li>• Internal WeWrite links won't show URLs by default</li>
                </ul>
              </div>

              {/* Hidden in Print */}
              <div className="wewrite-card bg-muted/30">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Icon name="EyeOff" size={16} className="text-muted-foreground" />
                  Hidden When Printing
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Navigation (header, sidebar, bottom nav)</li>
                  <li>• Page stats (views, edits, supporters)</li>
                  <li>• Graph view, replies, and related pages</li>
                  <li>• What links here and backlinks</li>
                  <li>• Buttons, dropdowns, and interactive elements</li>
                  <li>• Loading skeletons and spinners</li>
                  <li>• Allocation bar and sponsorship cards</li>
                </ul>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="lg:col-span-2">
              <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-lg">
                <div className="text-xs text-muted-foreground mb-2 text-center">
                  Preview ({settings.paperSize === 'letter' ? '8.5" × 11"' : '210mm × 297mm'})
                </div>

                {/* Paper Preview */}
                <div
                  ref={previewRef}
                  className={`bg-white text-black mx-auto shadow-lg overflow-hidden ${paperClass}`}
                  style={{ minHeight: '600px' }}
                >
                  <div className={`py-8 ${marginClass} ${fontSizeClass}`}>
                    {/* Print Header */}
                    {settings.showHeader && (
                      <div className="mb-8 pb-4 border-b border-gray-200">
                        <h1 className="text-2xl font-bold text-black leading-tight">
                          {displayData.title}
                        </h1>
                      </div>
                    )}

                    {/* Print Meta */}
                    {settings.showMeta && (
                      <div className="mb-6 text-sm text-gray-600 print-meta">
                        <span>By {displayData.authorDisplayName || displayData.authorUsername || displayData.author}</span>
                        <span className="mx-2">•</span>
                        <span>{displayData.date || new Date().toLocaleDateString()}</span>
                        {displayData.sponsors > 0 && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{displayData.sponsors} supporters</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <div
                      className="prose prose-sm max-w-none print-content"
                      dangerouslySetInnerHTML={{
                        __html: getContentHtml(displayData.content)
                      }}
                      style={{
                        '--tw-prose-body': 'black',
                        '--tw-prose-headings': 'black',
                        '--tw-prose-links': 'black',
                        '--tw-prose-quotes': '#333',
                      } as React.CSSProperties}
                    />

                    {/* Print Footer */}
                    {settings.showFooter && (
                      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
                        <p>Published on WeWrite • www.getwewrite.app</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CSS Documentation */}
          <div className="mt-8 wewrite-card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icon name="Code" size={20} className="text-muted-foreground" />
              Print CSS Classes
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Use these CSS classes to control print behavior in your components:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <code className="text-sm font-mono text-primary">.no-print</code>
                <p className="text-xs text-muted-foreground mt-1">Hide element when printing</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <code className="text-sm font-mono text-primary">.print-only</code>
                <p className="text-xs text-muted-foreground mt-1">Show element only when printing</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <code className="text-sm font-mono text-primary">.print-title</code>
                <p className="text-xs text-muted-foreground mt-1">Page title styling (24pt)</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <code className="text-sm font-mono text-primary">.print-meta</code>
                <p className="text-xs text-muted-foreground mt-1">Author/date metadata line</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <code className="text-sm font-mono text-primary">.print-content</code>
                <p className="text-xs text-muted-foreground mt-1">Main content area</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <code className="text-sm font-mono text-primary">.print-footer</code>
                <p className="text-xs text-muted-foreground mt-1">Fixed footer branding</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <code className="text-sm font-mono text-primary">.page-break-before</code>
                <p className="text-xs text-muted-foreground mt-1">Force page break before element</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <code className="text-sm font-mono text-primary">.avoid-break</code>
                <p className="text-xs text-muted-foreground mt-1">Prevent page break inside element</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
