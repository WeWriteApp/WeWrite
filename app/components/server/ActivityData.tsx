/**
 * Server component that fetches recent activity data
 * This eliminates client-side loading states by pre-fetching the data
 *
 * MIGRATED: Now uses environment-aware API endpoints instead of direct Firebase calls
 */
export async function getServerActivityData(limitCount = 30) {
  try {
    console.log('Starting getServerActivityData with limit:', limitCount);

    // Use environment-aware API endpoint instead of direct Firebase calls
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/recent-edits/global?limit=${limitCount * 2}`, {
      cache: 'no-store', // Ensure fresh data for server components
      headers: {
        'Content-Type': 'application/json',
      }
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

    console.log(`✅ Server Activity Data: Successfully fetched ${activities.length} activities via API`);

    return { activities };

  } catch (err) {
    console.error("❌ Server Activity Data: Error fetching via API:", err);
    return { activities: [], error: "Failed to fetch recent activity" };
  }
}