// Simplified content types - only text and links
export const CONTENT_TYPES = {
  PARAGRAPH: 'paragraph',
  LINK: 'link'
} as const;

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];
