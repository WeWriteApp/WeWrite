import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompetitorComparison, getCompetitorSlugs, isValidCompetitor } from '../../constants/seo-comparisons';
import { PRODUCTION_URL } from '../../utils/urlConfig';

interface Props {
  params: Promise<{ competitor: string }>;
}

/**
 * Generate static paths for all competitor comparisons
 */
export async function generateStaticParams() {
  return getCompetitorSlugs().map((slug) => ({
    competitor: slug,
  }));
}

/**
 * Generate SEO metadata for each comparison page
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { competitor: competitorSlug } = await params;

  if (!isValidCompetitor(competitorSlug)) {
    return {
      title: 'Page Not Found',
    };
  }

  const comparison = getCompetitorComparison(competitorSlug)!;

  return {
    title: comparison.metaTitle,
    description: comparison.metaDescription,
    keywords: comparison.keywords,
    openGraph: {
      title: comparison.metaTitle,
      description: comparison.metaDescription,
      type: 'website',
      siteName: 'WeWrite',
      url: `${PRODUCTION_URL}/compare/${competitorSlug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: comparison.metaTitle,
      description: comparison.metaDescription,
    },
    alternates: {
      canonical: `${PRODUCTION_URL}/compare/${competitorSlug}`,
    },
  };
}

/**
 * Competitor Comparison Page
 *
 * SEO-optimized comparison pages for "WeWrite vs X" searches
 */
export default async function ComparisonPage({ params }: Props) {
  const { competitor: competitorSlug } = await params;

  // Validate the competitor slug
  if (!isValidCompetitor(competitorSlug)) {
    notFound();
  }

  const comparison = getCompetitorComparison(competitorSlug)!;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            {comparison.heroTitle}
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            {comparison.heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try WeWrite Free
            </Link>
            <Link
              href="/welcome"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-accent/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Feature Comparison
          </h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-3 bg-accent/50 border-b border-border">
              <div className="p-4 font-semibold text-foreground">Feature</div>
              <div className="p-4 font-semibold text-foreground text-center border-l border-border">
                WeWrite
              </div>
              <div className="p-4 font-semibold text-foreground text-center border-l border-border">
                {comparison.name}
              </div>
            </div>
            {/* Table Rows */}
            {comparison.comparisonPoints.map((point, index) => (
              <div
                key={index}
                className={`grid grid-cols-3 ${index !== comparison.comparisonPoints.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="p-4 text-foreground font-medium">
                  {point.feature}
                </div>
                <div className={`p-4 text-center border-l border-border ${point.wewriteWins ? 'bg-green-500/10' : ''}`}>
                  <span className="text-foreground">{point.wewrite}</span>
                  {point.wewriteWins && (
                    <span className="ml-2 text-green-600">✓</span>
                  )}
                </div>
                <div className="p-4 text-center border-l border-border text-muted-foreground">
                  {point.competitor}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Why Choose WeWrite Over {comparison.name}?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {comparison.advantages.map((advantage, index) => (
              <div
                key={index}
                className="bg-card rounded-xl p-6 border border-border"
              >
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {advantage.title}
                </h3>
                <p className="text-muted-foreground">
                  {advantage.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ideal For Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-accent/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-8">
            WeWrite is Perfect For
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {comparison.idealFor.map((audience, index) => (
              <span
                key={index}
                className="px-4 py-2 bg-card rounded-full text-foreground border border-border"
              >
                {audience}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Ready to Make the Switch?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of writers who have already switched to WeWrite.
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start Writing Free
          </Link>
        </div>
      </section>

      {/* Other Comparisons */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-accent/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-foreground mb-8">
            Compare With Other Platforms
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {getCompetitorSlugs()
              .filter((slug) => slug !== competitorSlug)
              .map((slug) => {
                const comp = getCompetitorComparison(slug)!;
                return (
                  <Link
                    key={slug}
                    href={`/compare/${slug}`}
                    className="px-6 py-3 bg-card rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
                  >
                    WeWrite vs {comp.name}
                  </Link>
                );
              })}
          </div>
        </div>
      </section>

      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: comparison.metaTitle,
            description: comparison.metaDescription,
            url: `${PRODUCTION_URL}/compare/${competitorSlug}`,
            mainEntity: {
              '@type': 'SoftwareApplication',
              name: 'WeWrite',
              applicationCategory: 'Writing Platform',
              operatingSystem: 'Web',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
            },
          }),
        }}
      />
    </div>
  );
}
