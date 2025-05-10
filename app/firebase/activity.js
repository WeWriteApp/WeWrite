import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc
} from "firebase/firestore";
import { app } from "./config";

const db = getFirestore(app);

/**
 * Gets recent activity data from Firestore
 *
 * @param {number} limitCount - Maximum number of activities to return
 * @returns {Promise<Object>} - Object containing activities array and error if any
 */
export const getRecentActivity = async (limitCount = 30) => {
  try {
    console.log('getRecentActivity: Starting with limit', limitCount);

    // Define only the fields we need to reduce data transfer
    const requiredFields = ["title", "lastModified", "userId", "username"];

    // Query to get recent pages (only public pages)
    const pagesQuery = query(
      collection(db, "pages"),
      where("isPublic", "==", true),
      orderBy("lastModified", "desc"),
      select(...requiredFields),
      limit(limitCount * 2)
    );

    let pagesSnapshot;
    try {
      pagesSnapshot = await getDocs(pagesQuery);
    } catch (queryError) {
      console.error('Error executing Firestore query:', queryError);
      // Return sample data for logged-out users
      return {
        activities: getSampleActivities(limitCount),
        note: "Using sample data due to database connection issues"
      };
    }

    if (pagesSnapshot.empty) {
      console.log('getRecentActivity: No pages found');
      // Return sample data when no real data exists
      return {
        activities: getSampleActivities(limitCount),
        note: "Using sample data because no pages were found"
      };
    }

    console.log(`getRecentActivity: Found ${pagesSnapshot.size} pages`);

    // Process each page to get its activity data
    const activitiesPromises = pagesSnapshot.docs.map(async (pageDoc) => {
      const pageData = pageDoc.data();
      const pageId = pageDoc.id;

      console.log(`Processing page ${pageId} with title "${pageData.title || 'Untitled'}"`);

      // Skip pages without content
      if (!pageData.content) {
        console.log(`Skipping page ${pageId} - no content`);
        return null;
      }

      try {
        // Get the page's history
        console.log(`Fetching history for page ${pageId}`);

        // Check if the history collection exists
        try {
          const historyQuery = query(
            collection(db, "pages", pageId, "history"),
            orderBy("timestamp", "desc"),
            limit(1)
          );

          const historySnapshot = await getDocs(historyQuery);

          if (historySnapshot.empty) {
            console.log(`No history found for page ${pageId}, using current content`);
            // No history, use current content as the only version
            const username = await getUsernameById(pageData.userId);
            console.log(`Username for ${pageData.userId}: ${username}`);

            return {
              pageId,
              pageName: pageData.title || "Untitled",
              userId: pageData.userId,
              username: username,
              timestamp: pageData.lastModified?.toDate() || new Date(),
              currentContent: pageData.content,
              previousContent: "",
              isPublic: pageData.isPublic
            };
          }

          // Get the most recent history entry
          const historyData = historySnapshot.docs[0].data();
          console.log(`Found history entry for page ${pageId} from ${historyData.timestamp?.toDate()}`);

          const username = await getUsernameById(pageData.userId);
          console.log(`Username for ${pageData.userId}: ${username}`);

          return {
            pageId,
            pageName: pageData.title || "Untitled",
            userId: pageData.userId,
            username: username,
            timestamp: historyData.timestamp?.toDate() || new Date(),
            currentContent: pageData.content,
            previousContent: historyData.content || "",
            isPublic: pageData.isPublic
          };
        } catch (historyErr) {
          console.error(`Error in history query for page ${pageId}:`, historyErr);
          throw historyErr;
        }
      } catch (err) {
        console.error(`Error fetching history for page ${pageId}:`, err);

        // Try to return a basic activity even if history fetch fails
        try {
          const username = await getUsernameById(pageData.userId);
          return {
            pageId,
            pageName: pageData.title || "Untitled",
            userId: pageData.userId,
            username: username,
            timestamp: pageData.lastModified?.toDate() || new Date(),
            currentContent: pageData.content,
            previousContent: "",
            isPublic: pageData.isPublic
          };
        } catch (fallbackErr) {
          console.error(`Failed to create fallback activity for ${pageId}:`, fallbackErr);
          return null;
        }
      }
    });

    // Wait for all promises to resolve
    const activityResults = await Promise.all(activitiesPromises);

    // Filter out null results and private pages
    const validActivities = activityResults
      .filter(activity => {
        // Skip null activities
        if (activity === null) {
          console.log('Filtering out null activity');
          return false;
        }
        // Only show public pages
        if (activity.isPublic !== true) {
          console.log(`Filtering out private page ${activity.pageId}`);
          return false;
        }
        return true;
      })
      .slice(0, limitCount);

    console.log(`After filtering: ${validActivities.length} valid activities`);

    console.log(`getRecentActivity: Returning ${validActivities.length} activities`);
    return { activities: validActivities };
  } catch (err) {
    console.error("Error fetching recent activity:", err);
    // Return sample data instead of empty array
    return {
      activities: getSampleActivities(limitCount),
      note: "Using sample data due to error",
      error: "Failed to fetch recent activity"
    };
  }
};

/**
 * Helper function to get username from Firestore
 *
 * @param {string} userId - User ID to get username for
 * @returns {Promise<string>} - Username or null
 */
async function getUsernameById(userId) {
  try {
    if (!userId) return null;

    // Try to get from Firestore
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.username || userData.displayName || "Missing username";
    }

    return "Missing username";
  } catch (err) {
    console.error("Error fetching user data:", err);
    return "Missing username";
  }
}

/**
 * Generate sample activity data for when the database is unavailable
 * This ensures the landing page always shows something in the activity section
 *
 * @param {number} count - Number of sample activities to generate
 * @returns {Array} - Array of sample activity objects
 */
export function getSampleActivities(count = 5) {
  // Use real page IDs that exist in the system
  // These are known page IDs from the roadmap
  const sampleActivities = [
    {
      pageId: 'zRNwhNgIEfLFo050nyAT', // Roadmap page
      pageName: 'WeWrite Roadmap',
      userId: 'sample-user-1',
      username: 'WeWrite Team',
      timestamp: new Date(),
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'Welcome to WeWrite! This platform allows you to create and share content with others. Get started by creating your first page.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    },
    {
      pageId: 'RFsPq1tbcOMtljwHyIMT', // Every Page is a Fundraiser
      pageName: 'Every Page is a Fundraiser',
      userId: 'sample-user-2',
      username: 'ContentCreator',
      timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'The WeWrite editor supports rich text formatting, links, and more. Try it out by creating a new page.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    },
    {
      pageId: 'aJFMqTEKuNEHvOrYE9c2', // No ads
      pageName: 'No Ads on WeWrite',
      userId: 'sample-user-1',
      username: 'WeWrite Team',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'Our community thrives on respectful interaction. Please be kind and constructive when creating content.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    },
    {
      pageId: 'ou1LPmpynpoirLrv99fq', // Multiple view modes
      pageName: 'Multiple View Modes',
      userId: 'sample-user-3',
      username: 'Developer',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'We\'re constantly improving WeWrite. Check out our roadmap to see what features are coming next.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    },
    {
      pageId: 'o71h6Lg1wjGSC1pYaKXz', // Recurring donations
      pageName: 'Recurring Donations',
      userId: 'sample-user-4',
      username: 'ContentCreator',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'Every page on WeWrite can be a fundraiser. Support your favorite creators by pledging to their pages.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    },
    {
      pageId: '4jw8FdMJHGofMc4G2QTw', // Collaborative pages
      pageName: 'Collaborative Pages',
      userId: 'sample-user-5',
      username: 'WritingCoach',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72), // 3 days ago
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'Learn how to effectively collaborate with others on WeWrite. Share your ideas and get feedback in real-time.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    },
    {
      pageId: 'N7Pg3iJ0OQhkpw16MTZW', // Map view
      pageName: 'Map View Feature',
      userId: 'sample-user-6',
      username: 'Teacher',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96), // 4 days ago
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'Discover how educators are using WeWrite to engage students in collaborative writing projects.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    },
    {
      pageId: '0krXqAU748w43YnWJwE2', // Calendar view
      pageName: 'Calendar View Feature',
      userId: 'sample-user-1',
      username: 'WeWrite Team',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120), // 5 days ago
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'Your privacy matters to us. Learn about our security measures and how we protect your data.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    },
    {
      pageId: 'zRNwhNgIEfLFo050nyAT', // Roadmap page (reused)
      pageName: 'WeWrite API Documentation',
      userId: 'sample-user-3',
      username: 'Developer',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 144), // 6 days ago
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'Integrate your applications with WeWrite using our comprehensive API.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    },
    {
      pageId: 'zRNwhNgIEfLFo050nyAT', // Roadmap page (reused)
      pageName: 'Markdown Cheatsheet',
      userId: 'sample-user-7',
      username: 'TechWriter',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 168), // 7 days ago
      currentContent: JSON.stringify([{ type: 'paragraph', children: [{ text: 'A quick reference guide for using Markdown formatting in your WeWrite pages.' }] }]),
      previousContent: '',
      isPublic: true,
      isSample: true
    }
  ];

  // Return the requested number of activities
  return sampleActivities.slice(0, count);
}