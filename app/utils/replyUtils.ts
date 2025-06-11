/**
 * Utility functions for handling reply functionality in WeWrite
 *
 * This module centralizes the reply logic to:
 * 1. Make the codebase more robust
 * 2. Ensure consistent behavior across the application
 * 3. Support extensibility for future reply types (agree/disagree/etc.)
 */

/**
 * Slate editor node interface
 */
interface SlateNode {
  type: string;
  children: Array<{ text: string } | SlateNode>;
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
  replyType?: string;
}

/**
 * Reply data interface
 */
interface ReplyData {
  title: string;
  content: SlateNode[];
  username: string;
}

/**
 * Generates a reply title based on the original page title
 *
 * @param originalTitle - The title of the original page
 * @returns Formatted reply title
 */
export const generateReplyTitle = (originalTitle?: string): string => {
  // Return empty string to allow user to set their own title
  return "";
};

/**
 * Creates standardized initial content for a reply
 *
 * @param options - Configuration options for the reply
 * @returns Slate editor nodes for the initial content
 */
export const createReplyContent = ({
  pageId,
  pageTitle = "Untitled",
  userId = "anonymous",
  username = "Anonymous",
  replyType = "standard"
}: ReplyOptions): SlateNode[] => {
  // This structure allows for future reply types (agree/disagree/etc.)
  switch (replyType) {
    case "standard":
    default:
      // Ensure we have a valid username to display
      const displayUsername = username && username !== "Anonymous" ? username : "Anonymous";

      // Create attribution paragraph with explicit flags
      const attributionParagraph = {
        type: "paragraph",
        isAttribution: true, // Add a flag to identify this as an attribution paragraph
        attributionType: "reply", // Specify the type of attribution
        children: [
          { text: `Replying to ` },
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
            url: `/user/${userId || "anonymous"}`,
            isUser: true,
            userId: userId || "anonymous",
            username: displayUsername,
            className: "user-link",
            children: [{ text: displayUsername }]
          }
        ]
      };

      return [attributionParagraph];
  }
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
