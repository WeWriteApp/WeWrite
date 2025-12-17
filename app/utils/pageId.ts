/**
 * Client-side page ID generation
 *
 * Generates IDs compatible with Firestore's auto-generated document IDs.
 * Firestore IDs are 20 characters, using [A-Za-z0-9] (62 chars).
 *
 * This allows us to generate the page ID client-side and navigate
 * directly to /{pageId}?new=true, eliminating the /new redirect.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 20;

/**
 * Generate a Firestore-compatible document ID
 * Uses crypto.getRandomValues for cryptographically secure randomness
 */
export function generatePageId(): string {
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment - use crypto API
    const array = new Uint8Array(ID_LENGTH);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => CHARS[byte % CHARS.length]).join('');
  } else {
    // Fallback for SSR or environments without crypto
    let id = '';
    for (let i = 0; i < ID_LENGTH; i++) {
      id += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }
    return id;
  }
}

/**
 * Build a URL for creating a new page
 * Generates the ID and constructs the full URL with parameters
 */
export function buildNewPageUrl(options?: {
  replyTo?: string;
  replyToTitle?: string;
  replyToUsername?: string;
  replyType?: 'agree' | 'disagree' | 'standard';
  pageUserId?: string;
  groupId?: string;
  customDate?: string;
  title?: string;
  content?: string;
  initialContent?: any;
  type?: string;
  ideas?: boolean;
}): string {
  const pageId = generatePageId();
  const params = new URLSearchParams();

  // Always add new=true to indicate this is a new page being created
  params.set('new', 'true');

  if (options) {
    if (options.replyTo) {
      params.set('replyTo', options.replyTo);
    }
    if (options.replyToTitle) {
      params.set('page', encodeURIComponent(options.replyToTitle));
    }
    if (options.replyToUsername) {
      params.set('username', encodeURIComponent(options.replyToUsername));
    }
    if (options.replyType) {
      params.set('replyType', options.replyType);
    }
    if (options.pageUserId) {
      params.set('pageUserId', options.pageUserId);
    }
    if (options.groupId) {
      params.set('groupId', options.groupId);
    }
    if (options.customDate) {
      params.set('customDate', options.customDate);
    }
    if (options.title) {
      params.set('title', options.title);
    }
    if (options.content) {
      params.set('content', options.content);
    }
    if (options.initialContent) {
      params.set('initialContent', encodeURIComponent(JSON.stringify(options.initialContent)));
    }
    if (options.type) {
      params.set('type', options.type);
    }
    if (options.ideas) {
      params.set('ideas', 'true');
    }
  }

  return `/${pageId}?${params.toString()}`;
}
