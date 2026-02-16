import { internalApiFetch } from '../../utils/internalApi';

/**
 * Server component that fetches recent activity data
 * This eliminates client-side loading states by pre-fetching the data
 *
 * MIGRATED: Now uses environment-aware API endpoints instead of direct Firebase calls
 */
export async function getServerActivityData(limitCount = 30) {
  try {

    // Use environment-aware API endpoint instead of direct Firebase calls
    // SECURITY: Uses validated internal API URL to prevent SSRF
    const response = await internalApiFetch(`/api/recent-edits/global?limit=${limitCount * 2}`, {
      cache: 'no-store', // Ensure fresh data for server components
    });

    if (!response.ok) {
      console.error('Failed to fetch recent activity data:', response.status, response.statusText);
      return { activities: [] };
    }

    const data = await response.json();

    if (!data.pages || data.pages.length === 0) {
      return { activities: [] };
    }

    // The API already returns processed activity data, so we can use it directly
    const activities = data.pages.slice(0, limitCount).map((page: any) => ({
      pageId: page.id,
      pageName: page.title || "Untitled",
      userId: page.userId,
      username: page.username || "Anonymous",
      timestamp: new Date(page.lastModified),
      currentContent: page.content || "",
      previousContent: "", // API doesn't provide previous content for performance
      lastDiff: page.lastDiff || { added: 0, removed: 0, hasChanges: false, preview: "" },
      isPublic: page.isPublic || false
    }));


    return { activities };

  } catch (err) {
    console.error("❌ Server Activity Data: Error fetching via API:", err);
    return { activities: [], error: "Failed to fetch recent activity" };
  }
}