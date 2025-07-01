import ActivityPageClient from './ActivityPageClient';
import { ActivityFilterProvider } from '../contexts/ActivityFilterContext';

/**
 * Server component for the activity page
 * This now uses client-side data fetching for better reliability
 */
export default function ActivityPage() {
  // We're now using client-side data fetching with useStaticRecentActivity
  // This is more reliable than server-side fetching with Firebase Admin
  return (
    <ActivityFilterProvider>
      <ActivityPageClient initialActivities={[]} initialError={null} />
    </ActivityFilterProvider>
  );
}