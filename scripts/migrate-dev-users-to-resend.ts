/**
 * Migration Script: Sync Dev Users to Resend Dev Test Audience
 * 
 * This script adds the dev/admin email addresses to the "dev test users"
 * audience segment in Resend for isolated testing of email campaigns.
 * 
 * Usage:
 *   bun run scripts/migrate-dev-users-to-resend.ts
 *   bun run scripts/migrate-dev-users-to-resend.ts --dry-run
 */

import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com';

// Audience IDs
const GENERAL_AUDIENCE_ID = '493da2d9-7034-4bb0-99de-1dcfac3b424d';
const DEV_TEST_AUDIENCE_ID = 'e475ed52-8398-442a-9d4e-80c5e97374d2';

// Dev/Admin email addresses to migrate to dev test audience
// NOTE: jamiegray2234@gmail.com is a REAL production user (username: jamie), NOT a dev user
const DEV_EMAILS = [
  { email: 'jamie@wewrite.app', firstName: 'Jamie' },
  { email: 'admin.test@wewrite.app', firstName: 'Admin Test' },
  { email: 'getwewrite+test1@gmail.com', firstName: 'Test1' },
  { email: 'getwewrite+test2@gmail.com', firstName: 'Test2' },
];

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

interface ContactResult {
  id?: string;
  error?: string;
}

/**
 * Create a contact in a Resend audience
 */
async function createContact(
  email: string, 
  firstName: string, 
  audienceId: string
): Promise<ContactResult> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }

  const response = await fetch(`${RESEND_API_URL}/audiences/${audienceId}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      first_name: firstName,
      unsubscribed: false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    // 409 means contact already exists
    if (response.status === 409) {
      return { id: 'existing' };
    }
    return { error: error.message || response.statusText };
  }

  return response.json();
}

/**
 * Remove a contact from a Resend audience
 */
async function removeContact(email: string, audienceId: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }

  // First, get the contact ID by listing contacts
  const listResponse = await fetch(`${RESEND_API_URL}/audiences/${audienceId}/contacts`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
  });

  if (!listResponse.ok) {
    console.error(`   Failed to list contacts in audience`);
    return false;
  }

  const contacts = await listResponse.json();
  const contact = contacts.data?.find((c: any) => c.email === email);

  if (!contact) {
    console.log(`   Contact not found in audience, skipping removal`);
    return true;
  }

  // Delete the contact
  const deleteResponse = await fetch(`${RESEND_API_URL}/audiences/${audienceId}/contacts/${contact.id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
  });

  return deleteResponse.ok;
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Dev Users → Resend Dev Test Audience Migration');
  console.log('==================================================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Dev Test Audience ID: ${DEV_TEST_AUDIENCE_ID}`);
  console.log('');

  if (!RESEND_API_KEY) {
    console.error('❌ RESEND_API_KEY environment variable is not set');
    process.exit(1);
  }

  console.log(`📋 Dev emails to migrate (${DEV_EMAILS.length}):`);
  DEV_EMAILS.forEach(({ email, firstName }) => {
    console.log(`   • ${email} (${firstName})`);
  });
  console.log('');

  // Stats
  let addedToDev = 0;
  let alreadyInDev = 0;
  let removedFromGeneral = 0;
  let failed = 0;

  // Process each dev email
  for (const { email, firstName } of DEV_EMAILS) {
    console.log(`\n📧 Processing: ${email}`);

    if (isDryRun) {
      console.log(`   Would add to dev test audience`);
      console.log(`   Would remove from general audience`);
      addedToDev++;
      removedFromGeneral++;
      continue;
    }

    // Step 1: Add to dev test audience
    console.log(`   Adding to dev test audience...`);
    try {
      const result = await createContact(email, firstName, DEV_TEST_AUDIENCE_ID);
      if (result.error) {
        console.error(`   ❌ Failed to add: ${result.error}`);
        failed++;
        continue;
      }
      if (result.id === 'existing') {
        console.log(`   ⏭️  Already exists in dev test audience`);
        alreadyInDev++;
      } else {
        console.log(`   ✅ Added to dev test audience`);
        addedToDev++;
      }
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      failed++;
      continue;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 600));

    // Step 2: Remove from general audience (optional - they can exist in both)
    console.log(`   Removing from general audience...`);
    try {
      const removed = await removeContact(email, GENERAL_AUDIENCE_ID);
      if (removed) {
        console.log(`   ✅ Removed from general audience`);
        removedFromGeneral++;
      } else {
        console.log(`   ⚠️  Could not remove from general audience`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  Could not remove from general (may not exist): ${error.message}`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 600));
  }

  // Summary
  console.log('\n');
  console.log('==================================================');
  console.log('📊 Summary');
  console.log('==================================================');
  console.log(`Total dev emails:        ${DEV_EMAILS.length}`);
  console.log(`Added to dev audience:   ${addedToDev}`);
  console.log(`Already in dev audience: ${alreadyInDev}`);
  console.log(`Removed from general:    ${removedFromGeneral}`);
  console.log(`Failed:                  ${failed}`);
  console.log('');

  if (isDryRun) {
    console.log('ℹ️  This was a dry run. No changes were made.');
    console.log('   Run without --dry-run to migrate contacts.');
  } else {
    console.log('✅ Migration complete!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. When sending broadcast emails in test mode, use the dev test audience');
    console.log('   2. Dev emails will only receive emails sent to the dev test audience');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
