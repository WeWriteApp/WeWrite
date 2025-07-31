# WeWrite Landing Page Architecture

## Overview

The WeWrite landing page system provides a comprehensive logged-out experience that showcases the platform's features, displays live content, and guides users toward registration. The architecture is designed for performance, analytics tracking, and user engagement.

## Core Architecture

### Entry Point: `app/page.tsx`
**Purpose**: Main route handler that determines whether to show authenticated home or landing page
**Key Logic**:
```typescript
return isAuthenticated ? (
  <ActivityFilterProvider>
    <Home />
  </ActivityFilterProvider>
) : (
  <LandingPage />
);
```

### Main Component: `app/components/landing/LandingPage.tsx`
**Purpose**: Orchestrates the entire landing page experience
**Key Features**:
- Platform animation cycling
- Analytics tracking integration
- Theme management (forces blue accent)
- Content fetching for feature roadmap
- Scroll-based section highlighting
- Mobile/desktop responsive behavior

## Component Hierarchy

```
LandingPage
├── Header (Navigation & Auth Buttons)
├── HeroSection (Main visual showcase)
│   ├── ProgressiveHeroText (Animated text)
│   ├── SparkleBackground (Visual effects)
│   └── Image Carousel with Lightbox
├── ActivityCarousel (Live user activity)
├── SimpleTrendingCarousel (Trending content)
├── Feature Roadmap Section
├── About Section
└── Footer
```

## Key Components

### 1. HeroSection (`app/components/landing/HeroSection.tsx`)
**Purpose**: Primary visual showcase with interactive elements
**Features**:
- **Image Carousel**: 5 app screenshots with auto-advance
- **Lightbox**: Click-to-expand with click-outside-to-close
- **3D Tilt Effect**: Mouse-based perspective transformation
- **Swipe Support**: Touch gestures for mobile navigation
- **Analytics Integration**: Tracks user interactions

**Key Props**:
```typescript
interface HeroSectionProps {
  fadeInClass: string;
  platformOptions: string[];
  platformIndex: number;
  isAnimatingPlatform: boolean;
  handlePlatformClick: () => void;
  platformRef: React.RefObject<HTMLSpanElement>;
}
```

### 2. ProgressiveHeroText (`app/components/landing/ProgressiveHeroText.tsx`)
**Purpose**: Animated text that cycles through platform descriptions
**Features**:
- Smooth text transitions
- Platform-specific messaging
- Click-to-advance functionality
- Responsive typography

### 3. SparkleBackground (`app/components/landing/SparkleBackground.tsx`)
**Purpose**: Animated background effects
**Features**:
- Particle animation system
- Performance-optimized rendering
- Responsive particle density

### 4. ActivityCarousel (`app/components/landing/ActivityCarousel.tsx`)
**Purpose**: Displays live user activity from the platform
**Features**:
- Real-time content fetching
- Horizontal scrolling interface
- User interaction previews
- Loading states and error handling

### 5. SimpleTrendingCarousel (`app/components/landing/SimpleTrendingCarousel.tsx`)
**Purpose**: Showcases trending content
**Features**:
- Trending algorithm integration
- Content preview cards
- Smooth carousel navigation
- Responsive grid layout

## Data Flow

### 1. Content Fetching
```typescript
// Feature roadmap content
const pageIds = [
  'RFsPq1tbcOMtljwHyIMT', // Every Page is a Fundraiser
  'aJFMqTEKuNEHvOrYE9c2', // No ads
  'ou1LPmpynpoirLrv99fq', // Multiple view modes
  // ... more feature pages
];
```

### 2. Analytics Integration
```typescript
// Track user interactions
analytics.trackInteractionEvent(ANALYTICS_EVENTS.HERO_IMAGE_CLICKED, {
  image_index: carouselIndex,
  interaction_type: 'lightbox_open'
});
```

### 3. Platform Animation
```typescript
// Cycling platform descriptions
const platformOptions = [
  "creators", "writers", "fundraisers", "storytellers", 
  "bloggers", "journalists", "activists", "entrepreneurs"
];
```

## Responsive Design

### Mobile Optimizations
- **Touch Gestures**: Swipe navigation for carousels
- **Simplified Layout**: Stacked components
- **Performance**: Reduced animations and effects
- **Accessibility**: Touch-friendly button sizes

### Desktop Enhancements
- **3D Effects**: Mouse-based tilt and hover states
- **Expanded Content**: More detailed descriptions
- **Advanced Interactions**: Keyboard navigation support
- **Lightbox**: Full-screen image viewing

## Performance Considerations

### 1. Image Optimization
- **Next.js Image**: Automatic optimization and lazy loading
- **Priority Loading**: Hero images marked as priority
- **Responsive Images**: Multiple sizes for different viewports

### 2. Code Splitting
- **Dynamic Imports**: Non-critical components loaded on demand
- **Lazy Loading**: Content below fold loaded progressively

### 3. Analytics Batching
- **Event Queuing**: Analytics events batched for performance
- **Debounced Tracking**: Prevents excessive event firing

## Authentication Integration

### Progressive Disclosure Pattern
1. **Allow Interaction**: Users can explore content without signing up
2. **Show Value**: Display live content and features
3. **Gentle Prompts**: Authentication CTAs at natural break points
4. **Seamless Transition**: Smooth flow from landing to authenticated experience

### Auth State Management
```typescript
const { user, isAuthenticated, isLoading } = useAuth();
// Landing page only shows when !isAuthenticated
```

## SEO & Accessibility

### SEO Optimizations
- **Semantic HTML**: Proper heading hierarchy and structure
- **Meta Tags**: Dynamic title and description
- **Schema Markup**: Structured data for search engines
- **Performance**: Fast loading times and Core Web Vitals

### Accessibility Features
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels and descriptions
- **Focus Management**: Logical tab order
- **Color Contrast**: WCAG compliant color schemes

## Analytics & Tracking

### Key Events Tracked
- **Hero Interactions**: Image clicks, carousel navigation
- **Content Engagement**: Scroll depth, time on sections
- **Conversion Funnel**: Sign-up button clicks, form interactions
- **Performance Metrics**: Load times, error rates

### Analytics Implementation
```typescript
const analytics = useWeWriteAnalytics();
analytics.trackInteractionEvent(ANALYTICS_EVENTS.LANDING_PAGE_LOADED, {
  user_agent: navigator.userAgent,
  viewport_size: `${window.innerWidth}x${window.innerHeight}`
});
```

## Configuration

### Environment Variables
- **API Endpoints**: Content fetching URLs
- **Analytics Keys**: Tracking service configuration
- **Feature Flags**: A/B testing and rollout controls

### Content Management
- **Feature Roadmap**: Page IDs for dynamic content
- **Hero Images**: Static assets in `/images/landing/`
- **Copy Text**: Centralized in component constants

## Deployment & Testing

### Build Process
- **Static Generation**: Pre-rendered for performance
- **Asset Optimization**: Images and CSS minification
- **Bundle Analysis**: Size monitoring and optimization

### Testing Strategy
- **Unit Tests**: Component behavior and logic
- **Integration Tests**: User flow validation
- **Performance Tests**: Load time and interaction metrics
- **A/B Tests**: Conversion optimization experiments

## Future Enhancements

### Planned Features
- **Personalization**: Content based on user interests
- **Internationalization**: Multi-language support
- **Advanced Analytics**: Heatmaps and user session recording
- **Dynamic Content**: CMS-driven feature updates

### Technical Improvements
- **Progressive Web App**: Enhanced mobile experience
- **Edge Caching**: Improved global performance
- **Real-time Updates**: Live content streaming
- **Advanced Animations**: More sophisticated visual effects
