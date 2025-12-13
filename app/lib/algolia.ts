/**
 * Algolia Search Client Configuration
 *
 * Provides environment-aware Algolia clients for both search (client-side safe)
 * and admin operations (server-side only).
 *
 * Index naming follows the same pattern as Firestore collections:
 * - Development: DEV_pages, DEV_users
 * - Production: pages, users
 */

import { algoliasearch, type SearchClient } from 'algoliasearch';
import { getEnvironmentPrefix, getEnvironmentType } from '../utils/environmentConfig';

// Algolia configuration from environment variables
const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!;
const ALGOLIA_SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!;
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;

/**
 * Algolia index names (base names, will be prefixed based on environment)
 */
export const ALGOLIA_INDICES = {
  PAGES: 'pages',
  USERS: 'users',
} as const;

/**
 * Get environment-specific Algolia index name
 * Follows the same pattern as Firestore collections (DEV_ prefix in development)
 */
export const getAlgoliaIndexName = (baseName: string): string => {
  const prefix = getEnvironmentPrefix();
  return `${prefix}${baseName}`;
};

/**
 * Get all Algolia index names for the current environment
 */
export const getAlgoliaIndexNames = () => {
  return {
    pages: getAlgoliaIndexName(ALGOLIA_INDICES.PAGES),
    users: getAlgoliaIndexName(ALGOLIA_INDICES.USERS),
  };
};

/**
 * Search client (safe for client-side use)
 * Uses the search-only API key which can only perform search operations
 */
let searchClient: SearchClient | null = null;

export const getSearchClient = (): SearchClient => {
  if (!ALGOLIA_APP_ID || !ALGOLIA_SEARCH_KEY) {
    throw new Error('Algolia search credentials not configured. Please set NEXT_PUBLIC_ALGOLIA_APP_ID and NEXT_PUBLIC_ALGOLIA_SEARCH_KEY');
  }

  if (!searchClient) {
    searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);
  }

  return searchClient;
};

/**
 * Admin client (server-side only!)
 * Uses the write API key which can create, update, and delete records
 * NEVER expose this to the client
 */
let adminClient: SearchClient | null = null;

export const getAdminClient = (): SearchClient => {
  if (typeof window !== 'undefined') {
    throw new Error('Algolia admin client cannot be used on the client side!');
  }

  if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
    throw new Error('Algolia admin credentials not configured. Please set NEXT_PUBLIC_ALGOLIA_APP_ID and ALGOLIA_ADMIN_KEY');
  }

  if (!adminClient) {
    adminClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
  }

  return adminClient;
};

/**
 * Page record structure for Algolia
 */
export interface AlgoliaPageRecord {
  objectID: string; // Required by Algolia, same as pageId
  title: string;
  content?: string; // Plain text content (extracted from editor format)
  authorId: string;
  authorUsername?: string;
  isPublic: boolean;
  createdAt: number; // Unix timestamp for sorting
  lastModified: number; // Unix timestamp for sorting
  alternativeTitles?: string[];
  // Optional metadata
  wordCount?: number;
  hasLocation?: boolean;
}

/**
 * User record structure for Algolia
 */
export interface AlgoliaUserRecord {
  objectID: string; // Required by Algolia, same as odotooouserId
  username: string;
  usernameLower: string; // For case-insensitive matching
  displayName?: string;
  bio?: string;
  photoURL?: string;
  createdAt?: number; // Unix timestamp
  // Optional metadata
  pageCount?: number;
  followerCount?: number;
}

/**
 * Search pages using Algolia
 */
export const searchPages = async (
  query: string,
  options?: {
    hitsPerPage?: number;
    page?: number;
    filters?: string;
    attributesToRetrieve?: string[];
  }
) => {
  const client = getSearchClient();
  const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.PAGES);

  const response = await client.searchSingleIndex<AlgoliaPageRecord>({
    indexName,
    searchParams: {
      query,
      hitsPerPage: options?.hitsPerPage ?? 20,
      page: options?.page ?? 0,
      filters: options?.filters,
      attributesToRetrieve: options?.attributesToRetrieve ?? [
        'objectID',
        'title',
        'authorId',
        'authorUsername',
        'isPublic',
        'lastModified',
        'alternativeTitles'
      ],
    },
  });

  return response;
};

/**
 * Search users using Algolia
 */
export const searchUsers = async (
  query: string,
  options?: {
    hitsPerPage?: number;
    page?: number;
    filters?: string;
    attributesToRetrieve?: string[];
  }
) => {
  const client = getSearchClient();
  const indexName = getAlgoliaIndexName(ALGOLIA_INDICES.USERS);

  const response = await client.searchSingleIndex<AlgoliaUserRecord>({
    indexName,
    searchParams: {
      query,
      hitsPerPage: options?.hitsPerPage ?? 20,
      page: options?.page ?? 0,
      filters: options?.filters,
      attributesToRetrieve: options?.attributesToRetrieve ?? [
        'objectID',
        'username',
        'displayName',
        'photoURL'
      ],
    },
  });

  return response;
};

/**
 * Multi-index search (pages and users simultaneously)
 */
export const searchAll = async (
  query: string,
  options?: {
    hitsPerPage?: number;
  }
) => {
  const client = getSearchClient();
  const indexNames = getAlgoliaIndexNames();

  const response = await client.search<AlgoliaPageRecord | AlgoliaUserRecord>({
    requests: [
      {
        indexName: indexNames.pages,
        query,
        hitsPerPage: options?.hitsPerPage ?? 10,
        attributesToRetrieve: [
          'objectID',
          'title',
          'authorId',
          'authorUsername',
          'isPublic',
          'lastModified',
          'alternativeTitles'
        ],
      },
      {
        indexName: indexNames.users,
        query,
        hitsPerPage: options?.hitsPerPage ?? 5,
        attributesToRetrieve: [
          'objectID',
          'username',
          'displayName',
          'photoURL'
        ],
      },
    ],
  });

  return {
    pages: response.results[0],
    users: response.results[1],
  };
};

/**
 * Log Algolia configuration for debugging
 */
export const logAlgoliaConfig = (): void => {
  const envType = getEnvironmentType();
  const indexNames = getAlgoliaIndexNames();

  console.log('[Algolia Config] Environment:', envType);
  console.log('[Algolia Config] App ID:', ALGOLIA_APP_ID ? `${ALGOLIA_APP_ID.substring(0, 4)}...` : 'NOT SET');
  console.log('[Algolia Config] Search Key:', ALGOLIA_SEARCH_KEY ? 'SET' : 'NOT SET');
  console.log('[Algolia Config] Admin Key:', ALGOLIA_ADMIN_KEY ? 'SET' : 'NOT SET');
  console.log('[Algolia Config] Index names:', indexNames);
};
