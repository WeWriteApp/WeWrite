/**
 * Utility functions for handling reply functionality in WeWrite
 *
 * This module centralizes the reply logic to:
 * 1. Make the codebase more robust
 * 2. Ensure consistent behavior across the application
 * 3. Support extensibility for future reply types (agree/disagree/etc.)
 */

/**
 * Editor node interface
 */
interface EditorNode {
  type: string;
  children: Array<{ text: string } | EditorNode>;
  [key: string]: any;
}

/**
 * Reply options interface
 */
interface ReplyOptions {
  pageId: string;
  pageTitle?: string;
  userId?: string;
  username?: string;
  replyType?: 'agree' | 'disagree' | 'standard' | null | string;
}

/**
 * Reply data interface
 */
interface ReplyData {
  title: string;
  content: EditorNode[];
  username: string;
}

/**
 * Generates a reply title based on the original page title
 *
 * @param originalTitle - The title of the original page
 * @returns Formatted reply title
 */
export const generateReplyTitle = (originalTitle?: string): string => {
  // Generate a meaningful default title that users can edit
  const baseTitle = originalTitle || "Untitled";
  return `Re: ${baseTitle}`;
};

/**
 * Creates standardized initial content for a reply
 *
 * @param options - Configuration options for the reply
 * @returns Editor nodes for the initial content
 */
export const createReplyContent = ({
  pageId,
  pageTitle = "Untitled",
  userId = "anonymous",
  username = "Anonymous",
  replyType = "standard"
}: ReplyOptions): EditorNode[] => {
  // This structure allows for future reply types (agree/disagree/etc.)
  const normalizedType = replyType === 'agree' || replyType === 'disagree' ? replyType : null;

  // Ensure we have a valid username to display
  // Keep "Anonymous" as a valid fallback - don't convert it to something else
  const displayUsername = username && username.trim() !== "" ? username : "Anonymous";

  const sentimentText = normalizedType === 'agree'
    ? 'I agree with '
    : normalizedType === 'disagree'
      ? 'I disagree with '
      : 'Replying to ';

  // Create attribution paragraph with explicit flags and replyType metadata
  const attributionParagraph = {
    type: "paragraph",
    isAttribution: true,
    attributionType: "reply",
    replyType: normalizedType || null,
    children: [
      { text: sentimentText },
      {
        type: "link",
        url: `/pages/${pageId}`,
        pageId: pageId,
        pageTitle: pageTitle || "Untitled",
        className: "page-link",
        isPageLink: true,
        children: [{ text: pageTitle || "Untitled" }]
      },
      { text: ` by ` },
      {
        type: "link",
        url: `/u/${userId || "anonymous"}`,
        isUser: true,
        userId: userId || "anonymous",
        username: displayUsername,
        className: "user-link",
        children: [{ text: displayUsername }]
      }
    ]
  };

  return [attributionParagraph];
};

/**
 * Encoded parameters interface
 */
interface EncodedParams {
  title: string;
  content: string;
  username: string;
}

/**
 * Encodes reply data for URL parameters
 *
 * @param replyData - Data needed for the reply
 * @returns Encoded parameters ready for URL
 */
export const encodeReplyParams = ({
  title,
  content,
  username
}: ReplyData): EncodedParams => {
  try {
    return {
      title: encodeURIComponent(title),
      content: encodeURIComponent(JSON.stringify(content)),
      username: encodeURIComponent(username)
    };
  } catch (error) {
    console.error("Error encoding reply parameters:", error);
    throw error;
  }
};
