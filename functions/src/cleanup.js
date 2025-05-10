/**
 * Cloud Functions for database cleanup and maintenance
 * These functions help optimize database usage and costs
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firestore if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Scheduled function to clean up temporary data
 * Runs every 3 days to remove expired temporary data
 * Reduced frequency from daily to reduce function execution costs
 */
exports.cleanupTemporaryData = functions.pubsub
  .schedule('every 72 hours')
  .onRun(async (context) => {
    try {
      const now = admin.firestore.Timestamp.now();

      // Get all documents with an expiry date in the past
      const snapshot = await db.collection('temporaryData')
        .where('expiresAt', '<', now)
        .get();

      if (snapshot.empty) {
        console.log('No expired temporary data to clean up');
        return null;
      }

      // Delete expired documents in batches
      const batchSize = 500; // Firestore limit
      const batches = [];
      let batch = db.batch();
      let operationCount = 0;

      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        operationCount++;

        // If we reach the batch limit, commit and start a new batch
        if (operationCount >= batchSize) {
          batches.push(batch.commit());
          batch = db.batch();
          operationCount = 0;
        }
      });

      // Commit any remaining operations
      if (operationCount > 0) {
        batches.push(batch.commit());
      }

      // Wait for all batches to complete
      await Promise.all(batches);

      console.log(`Cleaned up ${snapshot.size} expired temporary documents`);
      return null;
    } catch (error) {
      console.error('Error cleaning up temporary data:', error);
      return null;
    }
  });

/**
 * Scheduled function to pre-compute statistics
 * Runs every 48 hours to calculate and store frequently accessed statistics
 * Reduced frequency from daily to reduce function execution costs
 */
exports.computeDailyStats = functions.pubsub
  .schedule('every 48 hours')
  .onRun(async (context) => {
    try {
      // Get total user count
      const usersSnapshot = await db.collection('users').get();
      const userCount = usersSnapshot.size;

      // Get total page count
      const pagesSnapshot = await db.collection('pages').get();
      const pageCount = pagesSnapshot.size;

      // Get total public page count
      const publicPagesSnapshot = await db.collection('pages')
        .where('isPublic', '==', true)
        .get();
      const publicPageCount = publicPagesSnapshot.size;

      // Calculate average pages per user
      const avgPagesPerUser = userCount > 0 ? pageCount / userCount : 0;

      // Store the statistics
      await db.collection('statistics').doc('daily').set({
        userCount,
        pageCount,
        publicPageCount,
        avgPagesPerUser,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('Daily statistics computed and stored');
      return null;
    } catch (error) {
      console.error('Error computing daily statistics:', error);
      return null;
    }
  });

/**
 * Scheduled function to optimize database usage
 * Runs every two weeks to identify and fix inefficient data structures
 * Reduced frequency from weekly to reduce function execution costs
 */
exports.optimizeDatabaseUsage = functions.pubsub
  .schedule('every 336 hours') // Bi-weekly (14 days)
  .onRun(async (context) => {
    try {
      // Find pages with large content stored directly in the document
      // These should be moved to a subcollection to reduce document size
      const largeContentPagesSnapshot = await db.collection('pages')
        .where('contentSize', '>', 100000) // 100KB
        .get();

      if (!largeContentPagesSnapshot.empty) {
        console.log(`Found ${largeContentPagesSnapshot.size} pages with large content`);

        // Process each page to move content to a subcollection
        const batch = db.batch();

        for (const doc of largeContentPagesSnapshot.docs) {
          const pageData = doc.data();

          // Only process if content exists directly in the document
          if (pageData.content) {
            // Create a version document in the versions subcollection
            const versionRef = db.collection('pages').doc(doc.id)
              .collection('versions').doc();

            // Add the content to the version document
            batch.set(versionRef, {
              content: pageData.content,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              userId: pageData.userId || 'system',
              username: pageData.username || 'System',
              optimizationMigration: true
            });

            // Update the page document to reference the version and remove content
            batch.update(doc.ref, {
              content: admin.firestore.FieldValue.delete(),
              currentVersion: versionRef.id,
              lastOptimized: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }

        // Commit the batch
        await batch.commit();
        console.log(`Optimized ${largeContentPagesSnapshot.size} pages with large content`);
      }

      return null;
    } catch (error) {
      console.error('Error optimizing database usage:', error);
      return null;
    }
  });
