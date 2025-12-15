import React, { useState, useEffect } from "react";
import PillLink from "../utils/PillLink";
import { validateLink, getLinkDisplayText } from '../../utils/linkValidator';
import { usePillStyle } from "../../contexts/PillStyleContext";
import ExternalLinkPreviewModal from "../ui/ExternalLinkPreviewModal";
import { truncateExternalLinkText } from "../../utils/textTruncation";
import InternalLinkWithTitle from "./InternalLinkWithTitle";
import { getPageTitle } from "../../utils/pageUtils";
import { LinkMigrationHelper } from "../../types/linkNode";

// Type definitions
interface LinkNodeProps {
  node: any;
  canEdit?: boolean;
  isEditing?: boolean;
  onEditLink?: () => void; // Add callback for editing links
  children?: React.ReactNode; // Slate children (must be rendered for DOM mapping)
  // Slate.js attributes for editor integration
  [key: string]: any;
}

/**
 * LinkNode Component - Renders different types of links in the editor
 *
 * Handles:
 * - Internal page links (with optional author attribution)
 * - External links (with confirmation modal)
 * - Protocol links (special WeWrite protocol links)
 * - Compound links (page + author)
 */
const LinkNode: React.FC<LinkNodeProps> = ({ node, canEdit = false, isEditing = false, onEditLink, children, ...attributes }) => {

  // Check if we have Slate.js attributes (for editor mode) or not (for viewer mode)
  const hasSlateAttributes = attributes && Object.keys(attributes).length > 0;

  // Create wrapper props - use Slate attributes if available, otherwise use basic props
  const wrapperProps = hasSlateAttributes
    ? {
        ...attributes,
        contentEditable: false,
        style: { userSelect: 'none', display: 'inline-block', verticalAlign: 'baseline' }
      }
    : {
        style: { userSelect: 'none', display: 'inline-block', verticalAlign: 'baseline' }
      };
  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [linkNode, setLinkNode] = useState(node);

  // Update linkNode when node prop changes (this handles title updates from Editor)
  useEffect(() => {
    setLinkNode(node);
  }, [node]);

  // State for dynamically fetched page title
  const [fetchedPageTitle, setFetchedPageTitle] = useState<string | null>(null);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);



  // Add more robust error handling for invalid link nodes
  if (!linkNode || typeof linkNode !== 'object') {
    console.error('LINK_RENDER_ERROR: Invalid link node:', linkNode);
    return <span className="text-red-500">[Invalid Link]</span>;
  }



  // MAJOR FIX: Completely rewritten link validation for view mode
  // This ensures links created with any version of the editor will render correctly
  let validatedNode;
  try {
    // MIGRATION: Apply migration for legacy links that don't have isCustomText property
    let nodeToValidate = linkNode;
    if (linkNode.isCustomText === undefined && linkNode.type === 'link') {
      console.log('🔄 [LINKNODE] Migrating legacy link:', linkNode);
      nodeToValidate = LinkMigrationHelper.migrateOldLink(linkNode);
      console.log('🔄 [LINKNODE] Migrated to:', nodeToValidate);
    }

    // First try to validate the node directly
    validatedNode = validateLink(nodeToValidate);

    // If validation failed or returned null, try to extract a link object from the node
    if (!validatedNode && linkNode.children) {
      // Look for link objects in children
      for (const child of linkNode.children) {
        if (child && child.type === 'link') {
          validatedNode = validateLink(child);
          if (validatedNode) break;
        }
      }
    }

    // If we still don't have a valid node but have a URL, create a minimal valid link
    if (!validatedNode && linkNode.url) {
      validatedNode = validateLink({
        type: 'link',
        url: linkNode.url,
        children: [{ text: linkNode.displayText || linkNode.children?.[0]?.text || linkNode.url }],
        id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
    }

    // If still no valid node, check if this is a nested structure
    if (!validatedNode && linkNode.link && typeof linkNode.link === 'object') {
      validatedNode = validateLink(linkNode.link);
    }

    // Check for data property that might contain link information
    if (!validatedNode && linkNode.data && typeof linkNode.data === 'object') {
      if (linkNode.data.url || linkNode.data.href || linkNode.data.pageId) {
        validatedNode = validateLink({
          ...linkNode.data,
          type: 'link',
          children: [{ text: linkNode.data.displayText || linkNode.data.text || 'Link' }],
          id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
      }
    }

    // If still no valid node, create a fallback
    if (!validatedNode) {
      // Create a minimal valid link as fallback with a unique ID
      validatedNode = {
        type: 'link',
        url: linkNode.url || '#',
        children: [{ text: linkNode.displayText || linkNode.children?.[0]?.text || 'Link (Error)' }],
        displayText: linkNode.displayText || linkNode.children?.[0]?.text || 'Link (Error)',
        className: 'error-link',
        isError: true,
        id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
    }

    // CRITICAL FIX: Ensure the validated node has a unique ID
    if (!validatedNode.id) {
      validatedNode.id = `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // CRITICAL FIX: Ensure the validated node has proper children structure
    if (!validatedNode.children || !Array.isArray(validatedNode.children) || validatedNode.children.length === 0) {
      validatedNode.children = [{ text: validatedNode.displayText || 'Link' }];
    }
  } catch (error) {
    console.error('LINK_RENDER_ERROR: Error during link validation:', error);
    // Create a minimal valid link as fallback with a unique ID
    validatedNode = {
      type: 'link',
      url: linkNode.url || '#',
      children: [{ text: linkNode.displayText || linkNode.children?.[0]?.text || 'Link (Error)' }],
      displayText: linkNode.displayText || linkNode.children?.[0]?.text || 'Link (Error)',
      className: 'error-link',
      isError: true,
      id: `link-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  // If validation failed or returned null, show an error
  if (!validatedNode) {
    console.error('LINK_RENDER_ERROR: Link validation failed for node:', linkNode);
    return <span className="text-red-500">[Invalid Link]</span>;
  }

  // Extract properties from the validated node
  const href = validatedNode.url || '#';
  const pageId = validatedNode.pageId;
  const isExternal = validatedNode.isExternal === true;

  // Essential monitoring for external links
  if (isExternal && !validatedNode.url) {
    console.warn('⚠️ External link missing URL:', validatedNode);
  }
  const isPageLink = validatedNode.isPageLink === true;

  // Effect to fetch page title dynamically when missing
  useEffect(() => {
    const shouldFetchTitle = isPageLink &&
                            pageId &&
                            !validatedNode.pageTitle &&
                            !validatedNode.originalPageTitle &&
                            !isFetchingTitle &&
                            !fetchedPageTitle;

    if (shouldFetchTitle) {
      setIsFetchingTitle(true);
      getPageTitle(pageId)
        .then((title) => {
          if (title) {
            setFetchedPageTitle(title);
          }
        })
        .catch((error) => {
          console.error('Error fetching page title for', pageId, ':', error);
        })
        .finally(() => {
          setIsFetchingTitle(false);
        });
    }
  }, [isPageLink, pageId, validatedNode.pageTitle, validatedNode.originalPageTitle, isFetchingTitle, fetchedPageTitle]);

  // Determine if this is a protocol link
  const isProtocolLink =
    validatedNode.className?.includes('protocol-link') ||
    validatedNode.isProtocolLink === true ||
    (validatedNode.children?.[0]?.text === "WeWrite as a decentralized open protocol");

  // IMPROVED: Extract display text with better fallbacks and proper custom text handling
  const getTextFromNode = (node: any) => {
    // NOTE: Compound links are now handled separately in the rendering logic,
    // so this function only extracts the base text without compound formatting

    // Essential monitoring for text extraction issues
    if (!node.children && !node.text && !node.displayText && !node.pageTitle) {
      console.warn('⚠️ Link node missing all text sources:', node);
    }

    // CRITICAL FIX: Check for direct text property first (legacy links)
    // This handles legacy links that have a direct "text" property
    if (node.text && node.text.trim() && node.text !== 'Link' && node.text !== 'Page Link') {
      return node.text.trim();
    }

    // CRITICAL FIX: Properly extract custom text from children array
    // This is the most important source of custom text that users configure
    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      // Concatenate all text from children to handle custom text properly
      let customText = '';
      for (const child of node.children) {
        if (child && child.text) {
          customText += child.text;
        }
      }
      // If we found custom text and it's not just the default "Link", use it
      if (customText.trim() && customText !== 'Link' && customText !== 'Page Link') {
        return customText.trim();
      }
    }

    // 3. Check for explicit displayText property (backup for custom text)
    if (node.displayText && node.displayText !== 'Link' && node.displayText.trim()) {
      return node.displayText;
    }

    // 4. Check for pageTitle (for page links without custom text)
    if (node.pageTitle && node.pageTitle !== 'Link') {
      return node.pageTitle;
    }

    // 5. Check for originalPageTitle
    if (node.originalPageTitle && node.originalPageTitle !== 'Link') {
      return node.originalPageTitle;
    }

    // 6. Use the standardized utility function as fallback
    const utilityText = getLinkDisplayText(node);
    if (utilityText && utilityText !== 'Link') {
      return utilityText;
    }

    // 7. Check for text in data property
    if (node.data && typeof node.data === 'object') {
      if (node.data.text && node.data.text.trim()) return node.data.text;
      if (node.data.displayText && node.data.displayText.trim()) return node.data.displayText;
    }

    // 8. Use appropriate fallbacks based on link type
    if (isExternal && href) return href;
    if (pageId) return pageId.replace(/-/g, ' ');

    // Last resort fallback
    return null; // Return null so we can handle it explicitly
  };

  // SIMPLIFIED: Use the clean LinkNode structure for display text
  let displayText;

  if (validatedNode.isCustomText && validatedNode.customText) {
    // Custom text link - use the custom text
    displayText = validatedNode.customText;
  } else if (validatedNode.children && validatedNode.children[0] && validatedNode.children[0].text) {
    // Use text from children (this is the actual rendered text)
    displayText = validatedNode.children[0].text;
  } else if (pageId) {
    // Auto link - use page title
    displayText = validatedNode.pageTitle ||
                 validatedNode.originalPageTitle ||
                 fetchedPageTitle ||
                 (isFetchingTitle ? 'Loading...' : `Page: ${pageId}`);
  } else if (isExternal) {
    // External link fallback
    displayText = href;
  } else {
    displayText = 'Link';
  }

  // Essential monitoring for display text issues
  if (!displayText || displayText.trim() === '') {
    console.warn('⚠️ Link has empty display text:', validatedNode);
    displayText = 'Link';
  }

  // For protocol links, use a special component - no tooltip in view mode
  if (isProtocolLink) {
    return (
      <span
        {...wrapperProps}
        className="inline-block"
      >
        <PillLink
          href="/protocol"
          isPublic={true}
          className="protocol-link"
          isEditing={isEditing}
          onEditLink={isEditing ? onEditLink : undefined}
        >
          {displayText || "WeWrite Protocol"}
        </PillLink>
        <span style={{ display: 'none' }}>{children}</span>
      </span>
    );
  }

  // For internal page links, check if it's a compound link first
  if (pageId) {
    console.log('RENDERING_PAGE_LINK:', { pageId, displayText, validatedNode });

    // CRITICAL FIX: Extract original page title from multiple possible sources
    const originalPageTitle = validatedNode.pageTitle ||
                              validatedNode.originalPageTitle ||
                              validatedNode.data?.pageTitle ||
                              validatedNode.data?.originalPageTitle ||
                              null;

    // Essential monitoring for compound link issues
    if (validatedNode.showAuthor && !validatedNode.authorUsername && !validatedNode.authorUserId) {
      console.warn('⚠️ Compound link missing author info:', validatedNode);
    }

    // Check if this is a compound link with author attribution
    if (validatedNode.showAuthor && (validatedNode.authorUsername || validatedNode.authorUserId)) {
      console.log('🔥 COMPOUND LINK DEBUG:', {
        showAuthor: validatedNode.showAuthor,
        authorUsername: validatedNode.authorUsername,
        authorUserId: validatedNode.authorUserId,
        authorTier: validatedNode.authorTier,
        authorSubscriptionStatus: validatedNode.authorSubscriptionStatus,
        authorSubscriptionAmount: validatedNode.authorSubscriptionAmount
      });

      // Render compound link as two separate pills: [Page Title] by [Author Username]
      // Use the extracted displayText which already handles custom text properly
      let pageTitleText = displayText || originalPageTitle || 'Page';

      // Remove @ symbol from username if present
      const cleanUsername = validatedNode.authorUsername
        ? validatedNode.authorUsername.replace(/^@/, '')
        : '';

      // Ensure href is properly formatted for internal links
      const formattedHref = href.startsWith('/') ? href : `/${pageId}`;

      // Render as inline content matching regular pill link appearance
      // Use inline-flex to properly align all elements on the same baseline
      const compoundWrapperProps = hasSlateAttributes
        ? {
            ...attributes,
            contentEditable: false,
            style: { userSelect: 'none' } as React.CSSProperties
          }
        : {
            style: { userSelect: 'none' } as React.CSSProperties
          };

      return (
        <span
          {...compoundWrapperProps}
          className="compound-link-container inline-flex items-center"
        >
          <PillLink
            href={formattedHref}
            isPublic={true}
            className="page-link"
            data-page-id={pageId}
            isEditing={isEditing}
            onEditLink={isEditing ? onEditLink : undefined}
          >
            {pageTitleText}
          </PillLink>
          <span className="text-muted-foreground mx-1">by</span>
          <PillLink
            href={`/u/${validatedNode.authorUserId}`}
            isPublic={true}
            className="user-link"
            isEditing={isEditing}
            onEditLink={isEditing ? onEditLink : undefined}
          >
            <span className="inline-flex items-center gap-1">
              {cleanUsername || 'Loading...'}
              {(validatedNode.authorSubscriptionStatus === 'active' && validatedNode.authorSubscriptionAmount) && (
                <span className="inline-flex items-center justify-center text-[10px] font-bold text-primary-foreground bg-primary rounded px-1 min-w-[18px] h-[14px]">
                  ${validatedNode.authorSubscriptionAmount}
                </span>
              )}
            </span>
          </PillLink>
          <span style={{ display: 'none' }}>{children}</span>
        </span>
      );
    }

    // Regular single page link (non-compound)
    // Ensure href is properly formatted for internal links
    // WeWrite uses /{pageId} format, not /pages/{pageId}
    const formattedHref = href.startsWith('/') ? href : `/${pageId}`;

    // Ensure we have a valid display text for page links
    let finalDisplayText = displayText;
    if (!finalDisplayText) {
      finalDisplayText = originalPageTitle || `TEST PAGE LINK: ${pageId}`;
    }

    console.log(`🔍 [LINKNODE] Rendering InternalLinkWithTitle:`, {
      pageId,
      href: formattedHref,
      displayText: finalDisplayText,
      originalPageTitle
    });

    return (
      <span className="inline-block" {...wrapperProps}>
        <InternalLinkWithTitle
          pageId={pageId}
          href={formattedHref}
          displayText={finalDisplayText}
          originalPageTitle={originalPageTitle}
          showAuthor={false}
          authorUsername={null}
          canEdit={canEdit}
          isEditing={isEditing}
          onEditLink={onEditLink}
        />
        <span style={{ display: 'none' }}>{children}</span>
      </span>
    );
  }

  // For external links, use the PillLink component with a modal confirmation
  if (isExternal) {
    // Ensure we have a valid display text for external links
    let finalDisplayText = displayText;

    // Double-check for text in children as a fallback
    if (!finalDisplayText && validatedNode.children && validatedNode.children.length > 0 && validatedNode.children[0].text) {
      finalDisplayText = validatedNode.children[0].text;
    }

    // If still no text, use the URL as a last resort
    if (!finalDisplayText) {
      finalDisplayText = href;
    }

    // Truncate the display text for better UI
    const truncatedDisplayText = truncateExternalLinkText(finalDisplayText, href, 50);

    // TextView is now for viewing only - editing is handled by Editor component
    // Always render in view mode - normal external link behavior with modal
    const handleExternalLinkClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent event bubbling to prevent edit mode activation
      setShowExternalLinkModal(true);
    };

    return (
      <>
        <span
          {...wrapperProps}
          className="inline-block"
        >
          <PillLink
            href={href}
            isPublic={true}
            className="external-link"
            isEditing={isEditing}
            onEditLink={isEditing ? onEditLink : undefined}
            onClick={handleExternalLinkClick}
          >
            {truncatedDisplayText}
            {/* Removed duplicate ExternalLink icon - PillLink already adds it */}
          </PillLink>
          <span style={{ display: 'none' }}>{children}</span>
        </span>

        <ExternalLinkPreviewModal
          isOpen={showExternalLinkModal}
          onClose={() => setShowExternalLinkModal(false)}
          url={href}
          displayText={finalDisplayText}
        />
      </>
    );
  }

  // For other links (like special links), use the PillLink component
  // If displayText is empty or undefined, try to get text from children
  if (!displayText && validatedNode.children && Array.isArray(validatedNode.children)) {
    // Try to find any child with text
    for (const child of validatedNode.children) {
      if (child.text) {
        displayText = child.text;
        break;
      }
    }
  }

  // If still no text, use a generic fallback
  if (!displayText) {
    displayText = "Link";
  }

  // Use PillStyleContext for consistent styling between edit and view modes
  const { getPillStyleClasses } = usePillStyle();
  const pillStyles = getPillStyleClasses('paragraph');

  // TextView is now for viewing only - editing is handled by Editor component
  // Always render in view mode - normal navigation behavior
  return (
    <span
      {...wrapperProps}
      className="inline-block"
    >
      <PillLink
        href={href}
        isPublic={true}
        className="inline special-link"
        isEditing={isEditing}
        onEditLink={isEditing ? onEditLink : undefined}
      >
        {displayText}
      </PillLink>
      <span style={{ display: 'none' }}>{children}</span>
    </span>
  );
};

export default LinkNode;
