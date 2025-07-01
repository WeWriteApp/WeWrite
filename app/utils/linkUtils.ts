/**
 * Link Utilities
 *
 * This module provides utility functions for creating consistent link structures
 * across the application. It ensures that all links have the necessary properties
 * for proper styling and functionality.
 */

// Types
interface PageLinkOptions {
  pageId: string;
  pageTitle?: string;
  url?: string | null;
}

interface UserLinkOptions {
  userId: string;
  username?: string;
  url?: string | null;
}

interface ReplyAttributionOptions {
  pageId: string;
  pageTitle?: string;
  userId?: string;
  username?: string;
}

interface SlateTextNode {
  text: string;
}

interface SlateLinkNode {
  type: "link";
  url: string;
  pageId?: string;
  pageTitle?: string;
  originalPageTitle?: string;
  className: string;
  isPageLink?: boolean;
  isUser?: boolean;
  userId?: string;
  username?: string;
  children: SlateTextNode[];
}

interface SlateParagraphNode {
  type: "paragraph";
  isAttribution?: boolean;
  attributionType?: string;
  children: (SlateTextNode | SlateLinkNode)[];
}

/**
 * Creates a standardized page link structure
 */
export const createPageLink = ({
  pageId,
  pageTitle = "Untitled",
  url = null
}: PageLinkOptions): SlateLinkNode => {
  const title = pageTitle || "Untitled";
  return {
    type: "link",
    url: url || `/pages/${pageId}`,
    pageId,
    pageTitle: title,
    originalPageTitle: title, // CRITICAL FIX: Include originalPageTitle for immediate display
    className: "page-link",
    isPageLink: true,
    children: [{ text: title }]
  };
};

/**
 * Creates a standardized user link structure
 */
export const createUserLink = ({
  userId,
  username = "Missing username",
  url = null
}: UserLinkOptions): SlateLinkNode => {
  // Ensure we have a valid username to display
  // Never use "Anonymous" - use "Missing username" instead
  let displayUsername = "Missing username";

  if (username &&
      typeof username === 'string' &&
      username.trim() !== "" &&
      username.trim().toLowerCase() !== "anonymous" &&
      username.trim() !== "Missing username") {
    displayUsername = username.trim();
  }

  // Log the username being used
  console.log(`Creating user link with username: ${displayUsername} (original: ${username}), userId: ${userId}`);

  return {
    type: "link",
    url: url || `/user/${userId || "anonymous"}`,
    isUser: true,
    userId: userId || "anonymous",
    username: displayUsername,
    className: "user-link",
    children: [{ text: displayUsername }]
  };
};

/**
 * Creates a standardized reply attribution line
 */
export const createReplyAttribution = ({
  pageId,
  pageTitle = "Untitled",
  userId = "anonymous",
  username = "Missing username"
}: ReplyAttributionOptions): SlateParagraphNode => {
  // Ensure we have a valid username - never use "Anonymous" as fallback
  let displayUsername = username || "Missing username";

  // Only override if the username is explicitly invalid
  if (!username ||
      typeof username !== 'string' ||
      username.trim() === "" ||
      username.trim().toLowerCase() === "anonymous") {
    displayUsername = "Missing username";
  } else {
    displayUsername = username.trim();
  }

  console.log(`Creating reply attribution with username: ${displayUsername} (original: ${username})`);

  // Create the user link with explicit username
  const userLink = createUserLink({ userId, username: displayUsername });

  // Create the page link with originalPageTitle for immediate display
  const pageLink = createPageLink({ pageId, pageTitle });

  return {
    type: "paragraph",
    isAttribution: true, // Add a flag to identify this as an attribution paragraph
    attributionType: "reply", // Specify the type of attribution
    children: [
      { text: "Replying to " },
      pageLink,
      { text: " by " },
      userLink
    ]
  };
};