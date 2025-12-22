import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getVertical, getVerticalSlugs, isValidVertical, LANDING_VERTICALS } from '../../constants/landing-verticals';
import VerticalLandingClient from './VerticalLandingClient';

interface Props {
  params: Promise<{ vertical: string }>;
}

/**
 * Generate static paths for all verticals
 */
export async function generateStaticParams() {
  return getVerticalSlugs().map((slug) => ({
    vertical: slug,
  }));
}

/**
 * Generate SEO metadata for each vertical landing page
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vertical: verticalSlug } = await params;

  if (!isValidVertical(verticalSlug)) {
    return {
      title: 'Page Not Found',
    };
  }

  const vertical = getVertical(verticalSlug);

  return {
    title: vertical.metaTitle,
    description: vertical.metaDescription,
    keywords: vertical.keywords,
    openGraph: {
      title: vertical.metaTitle,
      description: vertical.metaDescription,
      type: 'website',
      siteName: 'WeWrite',
      url: `https://wewrite.app/welcome/${verticalSlug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: vertical.metaTitle,
      description: vertical.metaDescription,
    },
    alternates: {
      canonical: `https://wewrite.app/welcome/${verticalSlug}`,
    },
  };
}

/**
 * Vertical-specific landing page
 *
 * Displays the landing page with customized hero text for specific verticals.
 * All verticals use the same LandingPage component - only the hero text changes.
 */
export default async function VerticalWelcomePage({ params }: Props) {
  const { vertical: verticalSlug } = await params;

  // Validate the vertical slug
  if (!isValidVertical(verticalSlug)) {
    notFound();
  }

  const vertical = getVertical(verticalSlug);

  return (
    <VerticalLandingClient
      heroTitle={vertical.heroTitle}
      heroSubtitle={vertical.heroSubtitle}
    />
  );
}
