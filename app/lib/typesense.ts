/**
 * Typesense Search Client Configuration
 *
 * Provides environment-aware Typesense clients for both search (client-side safe)
 * and admin operations (server-side only).
 *
 * Collection naming follows the same pattern as Firestore collections:
 * - Development: DEV_pages, DEV_users
 * - Production: pages, users
 *
 * Typesense is the primary search engine for WeWrite.
 */

import Typesense from 'typesense';
import type { Client as TypesenseClient } from 'typesense';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { getEnvironmentPrefix, getEnvironmentType } from '../utils/environmentConfig';

// Typesense configuration from environment variables
const TYPESENSE_HOST = process.env.NEXT_PUBLIC_TYPESENSE_HOST;
const TYPESENSE_PORT = process.env.NEXT_PUBLIC_TYPESENSE_PORT || '443';
const TYPESENSE_PROTOCOL = process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL || 'https';
const TYPESENSE_SEARCH_KEY = process.env.NEXT_PUBLIC_TYPESENSE_SEARCH_KEY;
const TYPESENSE_ADMIN_KEY = process.env.TYPESENSE_ADMIN_KEY;

/**
 * Check if Typesense is configured
 */
export const isTypesenseConfigured = (): boolean => {
  return !!(TYPESENSE_HOST && TYPESENSE_SEARCH_KEY);
};

/**
 * Check if Typesense admin is configured
 */
export const isTypesenseAdminConfigured = (): boolean => {
  return !!(TYPESENSE_HOST && TYPESENSE_ADMIN_KEY);
};

/**
 * Typesense collection names (base names, will be prefixed based on environment)
 */
export const TYPESENSE_COLLECTIONS = {
  PAGES: 'pages',
  USERS: 'users',
} as const;

/**
 * Get environment-specific Typesense collection name
 * Follows the same pattern as Firestore collections (DEV_ prefix in development)
 */
export const getTypesenseCollectionName = (baseName: string): string => {
  const prefix = getEnvironmentPrefix();
  return `${prefix}${baseName}`;
};

/**
 * Get all Typesense collection names for the current environment
 */
export const getTypesenseCollectionNames = () => {
  return {
    pages: getTypesenseCollectionName(TYPESENSE_COLLECTIONS.PAGES),
    users: getTypesenseCollectionName(TYPESENSE_COLLECTIONS.USERS),
  };
};

/**
 * Search client (safe for client-side use)
 * Uses the search-only API key which can only perform search operations
 */
let searchClient: TypesenseClient | null = null;

export const getSearchClient = (): TypesenseClient => {
  if (!TYPESENSE_HOST || !TYPESENSE_SEARCH_KEY) {
    throw new Error('Typesense search credentials not configured. Please set NEXT_PUBLIC_TYPESENSE_HOST and NEXT_PUBLIC_TYPESENSE_SEARCH_KEY');
  }

  if (!searchClient) {
    searchClient = new Typesense.Client({
      nodes: [{
        host: TYPESENSE_HOST,
        port: parseInt(TYPESENSE_PORT, 10),
        protocol: TYPESENSE_PROTOCOL,
      }],
      apiKey: TYPESENSE_SEARCH_KEY,
      connectionTimeoutSeconds: 5,
      retryIntervalSeconds: 0.1,
      numRetries: 3,
    });
  }

  return searchClient;
};

/**
 * Admin client (server-side only!)
 * Uses the admin API key which can create, update, and delete records
 * NEVER expose this to the client
 */
let adminClient: TypesenseClient | null = null;

export const getAdminClient = (): TypesenseClient => {
  if (typeof window !== 'undefined') {
    throw new Error('Typesense admin client cannot be used on the client side!');
  }

  if (!TYPESENSE_HOST || !TYPESENSE_ADMIN_KEY) {
    throw new Error('Typesense admin credentials not configured. Please set NEXT_PUBLIC_TYPESENSE_HOST and TYPESENSE_ADMIN_KEY');
  }

  if (!adminClient) {
    adminClient = new Typesense.Client({
      nodes: [{
        host: TYPESENSE_HOST,
        port: parseInt(TYPESENSE_PORT, 10),
        protocol: TYPESENSE_PROTOCOL,
      }],
      apiKey: TYPESENSE_ADMIN_KEY,
      connectionTimeoutSeconds: 10,
      retryIntervalSeconds: 0.1,
      numRetries: 3,
    });
  }

  return adminClient;
};

/**
 * Page document structure for Typesense
 */
export interface TypesensePageDocument {
  id: string; // Same as pageId (Typesense uses 'id' not 'objectID')
  title: string;
  titleLower: string; // For case-insensitive exact matching
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
 * User document structure for Typesense
 */
export interface TypesenseUserDocument {
  id: string; // Same as userId (Typesense uses 'id' not 'objectID')
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
 * Pages collection schema for Typesense
 */
export const getPagesCollectionSchema = (): CollectionCreateSchema => {
  const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.PAGES);

  return {
    name: collectionName,
    fields: [
      { name: 'title', type: 'string', facet: false },
      { name: 'titleLower', type: 'string', facet: false },
      { name: 'content', type: 'string', facet: false, optional: true },
      { name: 'authorId', type: 'string', facet: true },
      { name: 'authorUsername', type: 'string', facet: false, optional: true },
      { name: 'isPublic', type: 'bool', facet: true },
      { name: 'createdAt', type: 'int64', facet: false },
      { name: 'lastModified', type: 'int64', facet: false },
      { name: 'alternativeTitles', type: 'string[]', facet: false, optional: true },
      { name: 'wordCount', type: 'int32', facet: false, optional: true },
      { name: 'hasLocation', type: 'bool', facet: true, optional: true },
    ],
    default_sorting_field: 'lastModified',
    token_separators: ['-', '_'],
    symbols_to_index: ['@'],
  };
};

/**
 * Users collection schema for Typesense
 */
export const getUsersCollectionSchema = (): CollectionCreateSchema => {
  const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.USERS);

  return {
    name: collectionName,
    fields: [
      { name: 'username', type: 'string', facet: false },
      { name: 'usernameLower', type: 'string', facet: false },
      { name: 'displayName', type: 'string', facet: false, optional: true },
      { name: 'bio', type: 'string', facet: false, optional: true },
      { name: 'photoURL', type: 'string', facet: false, optional: true },
      { name: 'createdAt', type: 'int64', facet: false, optional: true },
      { name: 'pageCount', type: 'int32', facet: false, optional: true },
      { name: 'followerCount', type: 'int32', facet: false, optional: true },
    ],
    token_separators: ['-', '_'],
    symbols_to_index: ['@'],
  };
};

/**
 * Search result structure from Typesense
 */
export interface TypesenseSearchResult<T> {
  found: number;
  hits: Array<{
    document: T;
    highlight?: Record<string, { snippet?: string; value?: string }>;
    text_match?: number;
  }>;
  search_time_ms: number;
  page: number;
  out_of: number;
}

/**
 * Search pages using Typesense
 */
export const searchPages = async (
  query: string,
  options?: {
    perPage?: number;
    page?: number;
    filterBy?: string;
    queryBy?: string[];
    includeFields?: string[];
  }
): Promise<TypesenseSearchResult<TypesensePageDocument>> => {
  const client = getSearchClient();
  const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.PAGES);

  const searchParams: any = {
    q: query,
    query_by: options?.queryBy?.join(',') || 'title,titleLower,content,authorUsername,alternativeTitles',
    per_page: options?.perPage ?? 20,
    page: options?.page ?? 1,
    sort_by: '_text_match:desc,lastModified:desc',
  };

  if (options?.filterBy) {
    searchParams.filter_by = options.filterBy;
  }

  if (options?.includeFields) {
    searchParams.include_fields = options.includeFields.join(',');
  }

  const response = await client.collections(collectionName).documents().search(searchParams);

  return response as TypesenseSearchResult<TypesensePageDocument>;
};

/**
 * Search users using Typesense
 */
export const searchUsers = async (
  query: string,
  options?: {
    perPage?: number;
    page?: number;
    filterBy?: string;
    queryBy?: string[];
    includeFields?: string[];
  }
): Promise<TypesenseSearchResult<TypesenseUserDocument>> => {
  const client = getSearchClient();
  const collectionName = getTypesenseCollectionName(TYPESENSE_COLLECTIONS.USERS);

  const searchParams: any = {
    q: query,
    query_by: options?.queryBy?.join(',') || 'username,usernameLower,displayName,bio',
    per_page: options?.perPage ?? 20,
    page: options?.page ?? 1,
    sort_by: '_text_match:desc',
  };

  if (options?.filterBy) {
    searchParams.filter_by = options.filterBy;
  }

  if (options?.includeFields) {
    searchParams.include_fields = options.includeFields.join(',');
  }

  const response = await client.collections(collectionName).documents().search(searchParams);

  return response as TypesenseSearchResult<TypesenseUserDocument>;
};

/**
 * Multi-collection search (pages and users simultaneously)
 */
export const searchAll = async (
  query: string,
  options?: {
    perPage?: number;
  }
): Promise<{
  pages: TypesenseSearchResult<TypesensePageDocument>;
  users: TypesenseSearchResult<TypesenseUserDocument>;
}> => {
  const collectionNames = getTypesenseCollectionNames();

  // Run searches in parallel
  const [pagesResult, usersResult] = await Promise.all([
    searchPages(query, {
      perPage: options?.perPage ?? 10,
      includeFields: ['id', 'title', 'authorId', 'authorUsername', 'isPublic', 'lastModified', 'alternativeTitles'],
    }),
    searchUsers(query, {
      perPage: options?.perPage ?? 5,
      includeFields: ['id', 'username', 'displayName', 'photoURL'],
    }),
  ]);

  return {
    pages: pagesResult,
    users: usersResult,
  };
};

/**
 * Create collections if they don't exist
 * Should only be called server-side
 */
export const ensureCollectionsExist = async (): Promise<{ pages: boolean; users: boolean }> => {
  const client = getAdminClient();
  const collectionNames = getTypesenseCollectionNames();
  const results = { pages: false, users: false };

  try {
    // Check/create pages collection
    try {
      await client.collections(collectionNames.pages).retrieve();
      console.log(`[Typesense] Collection ${collectionNames.pages} already exists`);
      results.pages = true;
    } catch (error: any) {
      if (error.httpStatus === 404) {
        console.log(`[Typesense] Creating collection ${collectionNames.pages}`);
        await client.collections().create(getPagesCollectionSchema());
        results.pages = true;
      } else {
        throw error;
      }
    }

    // Check/create users collection
    try {
      await client.collections(collectionNames.users).retrieve();
      console.log(`[Typesense] Collection ${collectionNames.users} already exists`);
      results.users = true;
    } catch (error: any) {
      if (error.httpStatus === 404) {
        console.log(`[Typesense] Creating collection ${collectionNames.users}`);
        await client.collections().create(getUsersCollectionSchema());
        results.users = true;
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('[Typesense] Error ensuring collections exist:', error);
    throw error;
  }

  return results;
};

/**
 * Get collection statistics
 */
export const getCollectionStats = async (): Promise<{
  pages: { numDocuments: number; name: string } | null;
  users: { numDocuments: number; name: string } | null;
}> => {
  const client = getAdminClient();
  const collectionNames = getTypesenseCollectionNames();

  let pagesStats = null;
  let usersStats = null;

  try {
    const pagesCollection = await client.collections(collectionNames.pages).retrieve();
    pagesStats = {
      numDocuments: pagesCollection.num_documents || 0,
      name: collectionNames.pages,
    };
  } catch (error) {
    console.warn(`[Typesense] Pages collection not found: ${collectionNames.pages}`);
  }

  try {
    const usersCollection = await client.collections(collectionNames.users).retrieve();
    usersStats = {
      numDocuments: usersCollection.num_documents || 0,
      name: collectionNames.users,
    };
  } catch (error) {
    console.warn(`[Typesense] Users collection not found: ${collectionNames.users}`);
  }

  return { pages: pagesStats, users: usersStats };
};

/**
 * Log Typesense configuration for debugging
 */
export const logTypesenseConfig = (): void => {
  const envType = getEnvironmentType();
  const collectionNames = getTypesenseCollectionNames();

  console.log('[Typesense Config] Environment:', envType);
  console.log('[Typesense Config] Host:', TYPESENSE_HOST ? `${TYPESENSE_HOST.substring(0, 20)}...` : 'NOT SET');
  console.log('[Typesense Config] Port:', TYPESENSE_PORT);
  console.log('[Typesense Config] Protocol:', TYPESENSE_PROTOCOL);
  console.log('[Typesense Config] Search Key:', TYPESENSE_SEARCH_KEY ? 'SET' : 'NOT SET');
  console.log('[Typesense Config] Admin Key:', TYPESENSE_ADMIN_KEY ? 'SET' : 'NOT SET');
  console.log('[Typesense Config] Collection names:', collectionNames);
  console.log('[Typesense Config] Configured:', isTypesenseConfigured());
};
