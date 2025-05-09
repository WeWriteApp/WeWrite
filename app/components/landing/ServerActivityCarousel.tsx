import { getServerActivityData } from '../server/ActivityData';
import ActivityCarouselClient from './ActivityCarouselClient';

/**
 * Server component that pre-fetches activity data and passes it to the client component
 * This eliminates the loading state by having the data ready on initial render
 */
export default async function ServerActivityCarousel() {
  console.log('ServerActivityCarousel: Starting');

  try {
    // Fetch activity data on the server
    const { activities, error } = await getServerActivityData(30);

    console.log('ServerActivityCarousel: Data fetched successfully', {
      count: activities?.length || 0,
      hasError: !!error
    });

    // Pass the pre-fetched data to the client component
    return <ActivityCarouselClient initialActivities={activities || []} initialError={error} />;
  } catch (err) {
    console.error('ServerActivityCarousel: Error fetching data:', err);
    console.error('ServerActivityCarousel: Error stack:', err.stack);

    // Return client component with error
    return <ActivityCarouselClient
      initialActivities={[]}
      initialError="Failed to load recent activity. Please try again later."
    />;
  }
}
