"use client";

import { useEffect, ReactNode } from 'react';
import { generateSchemaMarkup } from '../../utils/schemaMarkup';

interface StructuredDataProviderProps {
  type: string;
  data: Record<string, unknown>;
  children: ReactNode;
}

/**
 * Structured Data Provider for dynamic schema injection
 */
export function StructuredDataProvider({ type, data, children }: StructuredDataProviderProps) {
  useEffect(() => {
    if (!type || !data) return;

    // Generate schema markup
    const schema = generateSchemaMarkup(type, data);
    if (!schema) return;

    // Create script element
    const scriptId = `schema-${type}-${Date.now()}`;
    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);

    // Add to head
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [type, data]);

  return <>{children}</>;
}

interface Breadcrumb {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  breadcrumbs: Breadcrumb[];
}

/**
 * Breadcrumb Schema Component
 */
export function BreadcrumbSchema({ breadcrumbs }: BreadcrumbSchemaProps) {
  useEffect(() => {
    if (!breadcrumbs || breadcrumbs.length === 0) return;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: crumb.url
      }))
    };

    const scriptId = 'breadcrumb-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(schema);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [breadcrumbs]);

  return null;
}

interface FAQ {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqs: FAQ[];
}

/**
 * FAQ Schema Component for pages with Q&A content
 */
export function FAQSchema({ faqs }: FAQSchemaProps) {
  useEffect(() => {
    if (!faqs || faqs.length === 0) return;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer
        }
      }))
    };

    const scriptId = 'faq-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(schema);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [faqs]);

  return null;
}

interface Review {
  author: string;
  rating: number;
  text: string;
  date: string;
}

interface ItemReviewed {
  type?: string;
  name: string;
}

interface ReviewSchemaProps {
  reviews: Review[];
  itemReviewed: ItemReviewed;
}

/**
 * Review Schema Component for user feedback/reviews
 */
export function ReviewSchema({ reviews, itemReviewed }: ReviewSchemaProps) {
  useEffect(() => {
    if (!reviews || reviews.length === 0 || !itemReviewed) return;

    const aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length,
      reviewCount: reviews.length,
      bestRating: 5,
      worstRating: 1
    };

    const schema = {
      '@context': 'https://schema.org',
      '@type': itemReviewed.type || 'Thing',
      name: itemReviewed.name,
      aggregateRating,
      review: reviews.map(review => ({
        '@type': 'Review',
        author: {
          '@type': 'Person',
          name: review.author
        },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: review.rating,
          bestRating: 5,
          worstRating: 1
        },
        reviewBody: review.text,
        datePublished: review.date
      }))
    };

    const scriptId = 'review-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(schema);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [reviews, itemReviewed]);

  return null;
}

interface EventLocation {
  name: string;
  address: string;
}

interface EventOrganizer {
  name: string;
  url?: string;
}

interface EventOffers {
  price: number;
  currency?: string;
}

interface EventData {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  location?: EventLocation;
  organizer?: EventOrganizer;
  offers?: EventOffers;
}

interface EventSchemaProps {
  event: EventData;
}

/**
 * Event Schema Component for community events
 */
export function EventSchema({ event }: EventSchemaProps) {
  useEffect(() => {
    if (!event) return;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.name,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location ? {
        '@type': 'Place',
        name: event.location.name,
        address: event.location.address
      } : undefined,
      organizer: event.organizer ? {
        '@type': 'Organization',
        name: event.organizer.name,
        url: event.organizer.url
      } : undefined,
      offers: event.offers ? {
        '@type': 'Offer',
        price: event.offers.price,
        priceCurrency: event.offers.currency || 'USD',
        availability: 'https://schema.org/InStock'
      } : undefined
    };

    const scriptId = 'event-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(schema);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [event]);

  return null;
}

interface CourseOffers {
  price: number;
  currency?: string;
}

interface CourseData {
  name: string;
  description: string;
  code?: string;
  level?: string;
  skills?: string[];
  duration?: string;
  offers?: CourseOffers;
}

interface CourseSchemaProps {
  course: CourseData;
}

/**
 * Course Schema Component for educational content
 */
export function CourseSchema({ course }: CourseSchemaProps) {
  useEffect(() => {
    if (!course) return;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: course.name,
      description: course.description,
      provider: {
        '@type': 'Organization',
        name: 'WeWrite',
        url: process.env.NEXT_PUBLIC_BASE_URL || 'https://wewrite.app'
      },
      courseCode: course.code,
      educationalLevel: course.level,
      teaches: course.skills,
      timeRequired: course.duration,
      offers: course.offers ? {
        '@type': 'Offer',
        price: course.offers.price,
        priceCurrency: course.offers.currency || 'USD'
      } : undefined
    };

    const scriptId = 'course-schema';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(schema);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [course]);

  return null;
}
