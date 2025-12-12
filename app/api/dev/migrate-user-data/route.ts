import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/admin';
import { getCollectionName } from '../../../utils/environmentConfig';
import { DEV_TEST_USERS } from "../../../utils/testUsers";

/**
 * Development endpoint to migrate user data from old session IDs to proper Firebase-style UIDs
 * This fixes the disconnect between session system and user profiles
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development' || process.env.USE_DEV_AUTH !== 'true') {
      return NextResponse.json({
        error: 'Development auth not active'
      }, { status: 400 });
    }

    const admin = initAdmin();
    const db = admin.firestore();

    const results = [];

    // Migration mapping: old session ID -> proper Firebase UID
    const migrations = [
      {
        oldId: 'dev_test_user_1',
        newId: 'kJ8xQz2mN5fR7vB3wC9dE1gH6i4L', // testuser1
        username: 'testuser1',
        email: 'test1@wewrite.dev'
      },
      {
        oldId: 'dev_test_user_2', 
        newId: 'mP9yRa3nO6gS8wD4xE2hF5jK7m9N', // testuser2
        username: 'testuser2',
        email: 'test2@wewrite.dev'
      },
      {
        oldId: 'dev_test_admin',
        newId: 'qT1uVb4oQ7hU9xF5yG3iH6kL8n0P', // testadmin
        username: 'testadmin',
        email: 'admin@wewrite.dev'
      }
    ];

    for (const migration of migrations) {
      try {
        console.log(`🔄 Migrating data from ${migration.oldId} to ${migration.newId} (${migration.username})`);

        // Collections to migrate
        const collections = [
          'pages',
          'subscriptions',
          'usdBalances',
          'usdAllocations',
          'notifications',
          'activity'
        ];

        let migratedCollections = 0;
        let migratedDocuments = 0;

        for (const collectionName of collections) {
          const envCollectionName = getCollectionName(collectionName);
          
          try {
            // Find documents with old user ID
            const oldDocsQuery = db.collection(envCollectionName).where('userId', '==', migration.oldId);
            const oldDocsSnapshot = await oldDocsQuery.get();

            if (!oldDocsSnapshot.empty) {
              console.log(`  📄 Found ${oldDocsSnapshot.size} documents in ${envCollectionName} to migrate`);

              // Update each document
              const batch = db.batch();
              oldDocsSnapshot.docs.forEach(doc => {
                const docRef = db.collection(envCollectionName).doc(doc.id);
                batch.update(docRef, { userId: migration.newId });
              });

              await batch.commit();
              migratedDocuments += oldDocsSnapshot.size;
              migratedCollections++;
              console.log(`  ✅ Updated ${oldDocsSnapshot.size} documents in ${envCollectionName}`);
            }

            // Also check for subcollections (like user-specific subscriptions)
            if (collectionName === 'subscriptions') {
              const oldUserPath = `${getCollectionName('users')}/${migration.oldId}`;
              const newUserPath = `${getCollectionName('users')}/${migration.newId}`;
              
              const oldSubCollection = db.collection(`${oldUserPath}/${getCollectionName('subscriptions')}`);
              const oldSubSnapshot = await oldSubCollection.get();
              
              if (!oldSubSnapshot.empty) {
                console.log(`  📄 Found ${oldSubSnapshot.size} subscription documents to migrate`);
                
                for (const doc of oldSubSnapshot.docs) {
                  const data = doc.data();
                  // Create in new location
                  await db.collection(`${newUserPath}/${getCollectionName('subscriptions')}`).doc(doc.id).set({
                    ...data,
                    userId: migration.newId
                  });
                  // Delete from old location
                  await doc.ref.delete();
                }
                
                migratedDocuments += oldSubSnapshot.size;
                console.log(`  ✅ Migrated ${oldSubSnapshot.size} subscription documents`);
              }
            }

          } catch (collectionError) {
            console.warn(`  ⚠️ Error migrating ${envCollectionName}:`, collectionError.message);
          }
        }

        // Update user profile document if it exists with old ID
        const oldUserDoc = db.collection(getCollectionName('users')).doc(migration.oldId);
        const oldUserSnapshot = await oldUserDoc.get();
        
        if (oldUserSnapshot.exists) {
          const userData = oldUserSnapshot.data();
          
          // Create new user document with proper ID
          await db.collection(getCollectionName('users')).doc(migration.newId).set({
            ...userData,
            uid: migration.newId,
            username: migration.username,
            email: migration.email
          });
          
          // Delete old user document
          await oldUserDoc.delete();
          
          console.log(`  ✅ Migrated user profile from ${migration.oldId} to ${migration.newId}`);
          migratedDocuments++;
        }

        results.push({
          migration: `${migration.oldId} → ${migration.newId}`,
          username: migration.username,
          status: 'completed',
          migratedCollections,
          migratedDocuments
        });

        console.log(`✅ Migration completed for ${migration.username}: ${migratedDocuments} documents across ${migratedCollections} collections`);

      } catch (error) {
        console.error(`❌ Error migrating ${migration.username}:`, error);
        results.push({
          migration: `${migration.oldId} → ${migration.newId}`,
          username: migration.username,
          status: 'error',
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User data migration completed - Development environment now uses production-like Firebase UIDs',
      results,
      summary: {
        totalMigrations: results.length,
        successfulMigrations: results.filter(r => r.status === 'completed').length,
        totalDocumentsMigrated: results.reduce((sum, r) => sum + (r.migratedDocuments || 0), 0),
        totalCollectionsMigrated: results.reduce((sum, r) => sum + (r.migratedCollections || 0), 0)
      },
      instructions: [
        '✅ Data migration completed successfully',
        '🔄 All user data now uses proper Firebase-style UIDs (production-like)',
        '🧹 NEXT STEPS:',
        '  1. Clear ALL browser storage (localStorage, sessionStorage, cookies)',
        '  2. Hard refresh the browser (Cmd+Shift+R / Ctrl+Shift+R)',
        '  3. Log in again with test user credentials',
        '  4. Verify user profiles work at /user/testuser1',
        '  5. Confirm session uses proper Firebase UID (not dev_test_user_1)',
        '',
        '🎯 The development environment now mirrors production authentication!'
      ]
    });

  } catch (error) {
    console.error('Error in user data migration:', error);
    return NextResponse.json({
      error: 'Failed to migrate user data',
      message: error.message
    }, { status: 500 });
  }
}
