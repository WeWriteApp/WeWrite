/**
 * Mock data for trending pages in development environment
 * This is used when Firebase credentials are not available
 */

export const generateMockTrendingPages = (limit = 10) => {
  // Generate random hourly views for the last 24 hours
  const generateHourlyViews = () => {
    return Array(24).fill(0).map(() => Math.floor(Math.random() * 10));
  };

  // Sample page titles
  const sampleTitles = [
    "Getting Started with WeWrite",
    "How to Create Your First Page",
    "The Future of Social Writing",
    "Collaborative Writing Tips",
    "WeWrite Feature Guide",
    "Building a Writing Community",
    "Monetizing Your Content",
    "Writing for Impact",
    "Storytelling Techniques",
    "Digital Publishing Trends",
    "Creative Writing Workshop",
    "Technical Writing Guide",
    "Poetry Collections",
    "Science Fiction Worldbuilding",
    "Travel Writing Adventures"
  ];

  // Sample usernames
  const sampleUsernames = [
    "writingpro",
    "storycrafter",
    "wordsmith",
    "contentcreator",
    "novelista",
    "poetrymaster",
    "techwriter",
    "blogexpert",
    "journalkeeper",
    "essayist"
  ];

  // Generate mock trending pages
  return Array(Math.min(limit, 15)).fill(0).map((_, index) => {
    const hourlyViews = generateHourlyViews();
    const totalViews = hourlyViews.reduce((sum, views) => sum + views, 0);
    
    return {
      id: `mock-page-${index + 1}`,
      title: sampleTitles[index % sampleTitles.length],
      views: totalViews,
      hourlyViews: hourlyViews,
      userId: `mock-user-${index % 10 + 1}`,
      username: sampleUsernames[index % sampleUsernames.length]
    };
  }).sort((a, b) => b.views - a.views);
};
