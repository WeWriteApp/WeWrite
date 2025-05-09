import { getServerActivityData } from '../components/server/ActivityData';
import ActivityPageClient from './ActivityPageClient';

/**
 * Server component for the activity page
 * This pre-fetches the activity data on the server to eliminate loading states
 */
export default async function ActivityPage() {
  // Fetch activity data on the server
  const { activities, error } = await getServerActivityData(30);
  
  // Pass the pre-fetched data to the client component
  return <ActivityPageClient initialActivities={activities} initialError={error} />;
}
