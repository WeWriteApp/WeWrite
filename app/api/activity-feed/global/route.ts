/**
 * GLOBAL ACTIVITY FEED API
 *
 * This is the primary API endpoint for the global activity feed on the homepage.
 * Re-exports from the legacy recent-edits route for backward compatibility.
 *
 * Endpoint: GET /api/activity-feed/global
 *
 * Query parameters:
 * - limit: Maximum number of results (default: 20, max: 20)
 * - userId: Current user's ID for filtering
 * - includeOwn: Whether to include user's own activity (default: false)
 * - followingOnly: Whether to only show activity from followed users (default: false)
 * - hideUnverified: Whether to hide content from users without verified emails (default: true)
 * - hideLikelySpam: Whether to hide content from accounts flagged as likely spam (default: false)
 * - cursor: Pagination cursor for loading more results
 */

export { GET } from '../../recent-edits/global/route';
