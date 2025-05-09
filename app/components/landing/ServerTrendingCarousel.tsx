import { getServerTrendingData } from '../server/TrendingData';
import TrendingCarouselClient from './TrendingCarouselClient';

/**
 * Server component that pre-fetches trending data and passes it to the client component
 * This eliminates the loading state by having the data ready on initial render
 */
export default async function ServerTrendingCarousel({ limit = 20 }) {
  console.log('ServerTrendingCarousel: Starting with limit', limit);

  try {
    // Fetch trending data on the server
    const { trendingPages, error } = await getServerTrendingData(limit);

    console.log('ServerTrendingCarousel: Data fetched successfully', {
      count: trendingPages?.length || 0,
      hasError: !!error
    });

    // Pass the pre-fetched data to the client component
    return <TrendingCarouselClient initialTrendingPages={trendingPages || []} initialError={error} />;
  } catch (err) {
    console.error('ServerTrendingCarousel: Error fetching data:', err);
    console.error('ServerTrendingCarousel: Error stack:', err.stack);

    // Return client component with error
    return <TrendingCarouselClient
      initialTrendingPages={[]}
      initialError="Failed to load trending pages. Please try again later."
    />;
  }
}
