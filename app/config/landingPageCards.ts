/**
 * Landing Page Cards Configuration
 * 
 * Centralized configuration for all page preview cards on the logged-out landing page.
 * This makes it easy to add, remove, or rearrange cards without editing multiple files.
 */

export interface LandingPageCardConfig {
  /** Unique identifier for the card */
  id: string;
  /** Page ID to fetch and display */
  pageId: string;
  /** Custom title to display (overrides fetched title) */
  customTitle?: string;
  /** Custom button text (defaults to "Read full page") */
  buttonText?: string;
  /** Number of lines to show from the page content */
  maxLines?: number;
  /** Whether to show embedded allocation bar */
  showAllocationBar?: boolean;
  /** Author ID for allocation bar */
  authorId?: string;
  /** Source identifier for allocation bar */
  allocationSource?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether the card is enabled (allows for easy disable without removing) */
  enabled?: boolean;
}

/**
 * Landing Page Cards Configuration
 * 
 * Add, remove, or rearrange cards by modifying this array.
 * Cards will be displayed in the order they appear here.
 */
export const LANDING_PAGE_CARDS: LandingPageCardConfig[] = [
  {
    id: 'use-cases',
    pageId: 'AXjA19RQnFLhIIfuncBb',
    customTitle: 'WeWrite Use Cases',
    buttonText: 'Explore use cases',
    maxLines: 12,
    showAllocationBar: true,
    authorId: 'system',
    allocationSource: 'LandingPageCard',
    className: 'h-full',
    enabled: true
  },
  {
    id: 'competitors',
    pageId: '4iB6alhaxLHvktOccTHd',
    customTitle: 'WeWrite vs Competitors',
    buttonText: 'Read comparison',
    maxLines: 8,
    showAllocationBar: true,
    authorId: 'system',
    allocationSource: 'landing-competitors',
    className: 'w-full',
    enabled: true
  },
  {
    id: 'feature-roadmap',
    pageId: 'zRNwhNgIEfLFo050nyAT',
    customTitle: 'WeWrite Feature Roadmap',
    buttonText: 'Read full roadmap',
    maxLines: 12,
    showAllocationBar: true,
    authorId: 'system',
    allocationSource: 'LandingPageCard',
    className: 'h-full',
    enabled: true
  }
];

/**
 * Get enabled landing page cards in display order
 * This function now supports both static config and dynamic admin configuration
 */
export const getEnabledLandingPageCards = (): LandingPageCardConfig[] => {
  return LANDING_PAGE_CARDS.filter(card => card.enabled !== false);
};

/**
 * Fetch landing page cards from admin configuration (if available) or fallback to static config
 * This is used by the landing page to get the current configuration
 */
export const fetchLandingPageCards = async (): Promise<LandingPageCardConfig[]> => {
  try {
    // Try to fetch from admin configuration first
    const response = await fetch('/api/public/landing-page-cards');
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.data?.cards)) {
        return data.data.cards.filter((card: LandingPageCardConfig) => card.enabled !== false);
      }
    }
  } catch (error) {
    console.warn('Failed to fetch admin landing page cards config, using static config:', error);
  }

  // Fallback to static configuration
  return getEnabledLandingPageCards();
};

/**
 * Get a specific landing page card by ID
 */
export const getLandingPageCard = (id: string): LandingPageCardConfig | undefined => {
  return LANDING_PAGE_CARDS.find(card => card.id === id);
};

/**
 * Example of how to add a new card:
 * 
 * 1. Add a new entry to LANDING_PAGE_CARDS array:
 * {
 *   id: 'my-new-card',
 *   pageId: 'your-page-id-here',
 *   customTitle: 'My New Card Title',
 *   buttonText: 'Read more',
 *   maxLines: 10,
 *   showAllocationBar: true,
 *   authorId: 'system',
 *   allocationSource: 'LandingPageCard',
 *   className: 'h-full',
 *   enabled: true
 * }
 * 
 * 2. The card will automatically appear on the landing page
 * 
 * To disable a card temporarily, set enabled: false
 * To remove a card permanently, delete it from the array
 * To rearrange cards, change their order in the array
 */
