/**
 * Resend Contacts Service
 * 
 * Manages contacts in Resend audiences for broadcast/marketing emails.
 * Used for newsletters, product updates, and re-activation campaigns.
 * 
 * Audiences:
 *   - General (production): 493da2d9-7034-4bb0-99de-1dcfac3b424d
 *   - Dev Test Users: e475ed52-8398-442a-9d4e-80c5e97374d2
 */

import { getEnvironmentType } from '../utils/environmentConfig';

const RESEND_API_URL = 'https://api.resend.com';
const GENERAL_AUDIENCE_ID = '493da2d9-7034-4bb0-99de-1dcfac3b424d';
const DEV_TEST_AUDIENCE_ID = 'e475ed52-8398-442a-9d4e-80c5e97374d2';

/**
 * Get the appropriate audience ID based on environment
 * Dev environment users go to dev test audience, production users go to general
 */
function getDefaultAudienceId(): string {
  const envType = getEnvironmentType();
  return envType === 'development' ? DEV_TEST_AUDIENCE_ID : GENERAL_AUDIENCE_ID;
}

interface ResendContact {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
  unsubscribed: boolean;
}

interface CreateContactOptions {
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed?: boolean;
  audienceId?: string;
}

interface UpdateContactOptions {
  email?: string;
  firstName?: string;
  lastName?: string;
  unsubscribed?: boolean;
}

interface ContactListResponse {
  object: 'list';
  data: ResendContact[];
}

/**
 * Get the Resend API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Make a request to the Resend API
 */
async function resendRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const response = await fetch(`${RESEND_API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`Resend API error: ${error.message || response.statusText}`);
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Create a new contact in an audience
 */
export async function createContact(options: CreateContactOptions): Promise<{ id: string }> {
  const { email, firstName, lastName, unsubscribed = false, audienceId = GENERAL_AUDIENCE_ID } = options;
  
  console.log('[ResendContacts] Creating contact:', email);
  
  const result = await resendRequest<{ id: string }>(
    `/audiences/${audienceId}/contacts`,
    'POST',
    {
      email,
      first_name: firstName,
      last_name: lastName,
      unsubscribed,
    }
  );
  
  console.log('[ResendContacts] Contact created:', result.id);
  return result;
}

/**
 * Get a contact by ID
 */
export async function getContact(
  contactId: string,
  audienceId: string = GENERAL_AUDIENCE_ID
): Promise<ResendContact> {
  return resendRequest<ResendContact>(`/audiences/${audienceId}/contacts/${contactId}`);
}

/**
 * Get a contact by email
 */
export async function getContactByEmail(
  email: string,
  audienceId: string = GENERAL_AUDIENCE_ID
): Promise<ResendContact | null> {
  try {
    const contacts = await listContacts(audienceId);
    return contacts.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
  } catch (error) {
    console.error('[ResendContacts] Error finding contact by email:', error);
    return null;
  }
}

/**
 * Update a contact
 */
export async function updateContact(
  contactId: string,
  options: UpdateContactOptions,
  audienceId: string = GENERAL_AUDIENCE_ID
): Promise<{ id: string }> {
  console.log('[ResendContacts] Updating contact:', contactId);
  
  const body: any = {};
  if (options.email !== undefined) body.email = options.email;
  if (options.firstName !== undefined) body.first_name = options.firstName;
  if (options.lastName !== undefined) body.last_name = options.lastName;
  if (options.unsubscribed !== undefined) body.unsubscribed = options.unsubscribed;
  
  return resendRequest<{ id: string }>(
    `/audiences/${audienceId}/contacts/${contactId}`,
    'PATCH',
    body
  );
}

/**
 * Delete a contact
 */
export async function deleteContact(
  contactId: string,
  audienceId: string = GENERAL_AUDIENCE_ID
): Promise<void> {
  console.log('[ResendContacts] Deleting contact:', contactId);
  await resendRequest(`/audiences/${audienceId}/contacts/${contactId}`, 'DELETE');
}

/**
 * List all contacts in an audience
 */
export async function listContacts(
  audienceId: string = GENERAL_AUDIENCE_ID
): Promise<ResendContact[]> {
  const result = await resendRequest<ContactListResponse>(`/audiences/${audienceId}/contacts`);
  return result.data || [];
}

/**
 * Create or update a contact (upsert)
 * If contact exists, update it. If not, create it.
 */
export async function upsertContact(options: CreateContactOptions): Promise<{ id: string; created: boolean }> {
  const { email, audienceId = GENERAL_AUDIENCE_ID } = options;
  
  // Check if contact already exists
  const existing = await getContactByEmail(email, audienceId);
  
  if (existing) {
    // Update existing contact
    await updateContact(existing.id, {
      firstName: options.firstName,
      lastName: options.lastName,
      unsubscribed: options.unsubscribed,
    }, audienceId);
    return { id: existing.id, created: false };
  } else {
    // Create new contact
    const result = await createContact(options);
    return { id: result.id, created: true };
  }
}

/**
 * Sync a user to Resend contacts
 * Call this when a user signs up or updates their profile
 * NOTE: WeWrite uses username only, not displayName (deprecated)
 * 
 * In development: Users are added to the dev test audience
 * In production: Users are added to the general audience
 */
export async function syncUserToResend(user: {
  email: string;
  username?: string;
  marketingOptOut?: boolean;
}): Promise<{ id: string; created: boolean } | null> {
  try {
    const audienceId = getDefaultAudienceId();
    const envType = getEnvironmentType();
    
    // Use username as the first name for Resend contacts
    // We don't split names since WeWrite only has usernames, not full names
    const result = await upsertContact({
      email: user.email,
      firstName: user.username,
      lastName: undefined,
      unsubscribed: user.marketingOptOut ?? false,
      audienceId,
    });
    
    console.log(`[ResendContacts] User synced to ${envType === 'development' ? 'dev-test' : 'general'} audience:`, user.email, result.created ? '(new)' : '(updated)');
    return result;
  } catch (error) {
    console.error('[ResendContacts] Failed to sync user:', user.email, error);
    return null;
  }
}

/**
 * Unsubscribe a contact by email
 */
export async function unsubscribeByEmail(
  email: string,
  audienceId: string = GENERAL_AUDIENCE_ID
): Promise<boolean> {
  try {
    const contact = await getContactByEmail(email, audienceId);
    if (contact) {
      await updateContact(contact.id, { unsubscribed: true }, audienceId);
      console.log('[ResendContacts] Unsubscribed:', email);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[ResendContacts] Failed to unsubscribe:', email, error);
    return false;
  }
}

/**
 * Get audience statistics
 */
export async function getAudienceStats(audienceId: string = GENERAL_AUDIENCE_ID): Promise<{
  total: number;
  subscribed: number;
  unsubscribed: number;
}> {
  const contacts = await listContacts(audienceId);
  const subscribed = contacts.filter(c => !c.unsubscribed).length;
  return {
    total: contacts.length,
    subscribed,
    unsubscribed: contacts.length - subscribed,
  };
}

// Export constants
export const AUDIENCES = {
  GENERAL: GENERAL_AUDIENCE_ID,
};

export default {
  createContact,
  getContact,
  getContactByEmail,
  updateContact,
  deleteContact,
  listContacts,
  upsertContact,
  syncUserToResend,
  unsubscribeByEmail,
  getAudienceStats,
  AUDIENCES,
};
