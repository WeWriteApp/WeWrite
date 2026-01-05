/**
 * USER ACTIVITY FEED API
 *
 * This is the primary API endpoint for user-specific activity feeds (profile pages).
 * Re-exports from the legacy recent-edits route for backward compatibility.
 *
 * Endpoint: GET /api/activity-feed/user
 *
 * Query parameters:
 * - userId: The user ID to fetch activity for (REQUIRED)
 * - searchTerm: Optional search term to filter results
 * - limit: Maximum number of results (default: 20)
 */

export { GET } from '../../recent-edits/user/route';
