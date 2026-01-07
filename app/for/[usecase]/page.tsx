import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getUseCase, getUseCaseSlugs, isValidUseCase } from '../../constants/seo-usecases';
import { getVertical } from '../../constants/landing-verticals';
import { PRODUCTION_URL } from '../../utils/urlConfig';

interface Props {
  params: Promise<{ usecase: string }>;
}

/**
 * Generate static paths for all use cases
 */
export async function generateStaticParams() {
  return getUseCaseSlugs().map((slug) => ({
    usecase: slug,
  }));
}

/**
 * Generate SEO metadata for each use case landing page
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { usecase: usecaseSlug } = await params;

  if (!isValidUseCase(usecaseSlug)) {
    return {
      title: 'Page Not Found',
    };
  }

  const usecase = getUseCase(usecaseSlug)!;

  return {
    title: usecase.metaTitle,
    description: usecase.metaDescription,
    keywords: usecase.keywords,
    openGraph: {
      title: usecase.metaTitle,
      description: usecase.metaDescription,
      type: 'website',
      siteName: 'WeWrite',
      url: `${PRODUCTION_URL}/for/${usecaseSlug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: usecase.metaTitle,
      description: usecase.metaDescription,
    },
    alternates: {
      canonical: `${PRODUCTION_URL}/for/${usecaseSlug}`,
    },
  };
}

/**
 * Use Case Landing Page
 *
 * SEO-optimized landing pages for specific use cases like
 * "citizen journalism", "local news", "creative writing", etc.
 */
export default async function UseCasePage({ params }: Props) {
  const { usecase: usecaseSlug } = await params;

  // Validate the use case slug
  if (!isValidUseCase(usecaseSlug)) {
    notFound();
  }

  const usecase = getUseCase(usecaseSlug)!;

  // Get related verticals for internal linking
  const relatedVerticals = usecase.relatedVerticals
    .map(slug => {
      const vertical = getVertical(slug);
      return vertical ? { slug, name: vertical.name } : null;
    })
    .filter(Boolean) as { slug: string; name: string }[];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            {usecase.heroTitle}
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            {usecase.heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Start Writing Free
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

      {/* Benefits Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-accent/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Why WeWrite for {usecase.name}?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {usecase.benefits.map((benefit, index) => (
              <div
                key={index}
                className="bg-card rounded-xl p-6 border border-border"
              >
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-8">
            Perfect For
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {usecase.targetAudience.map((audience, index) => (
              <span
                key={index}
                className="px-4 py-2 bg-accent rounded-full text-foreground"
              >
                {audience}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-accent/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            How It Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Write
              </h3>
              <p className="text-muted-foreground">
                Create content using our simple editor. Publish instantly—no approvals needed.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Share
              </h3>
              <p className="text-muted-foreground">
                Your content is discoverable by search engines and shareable across the web.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Earn
              </h3>
              <p className="text-muted-foreground">
                Readers support your work directly. Every page is a fundraiser for your content.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">
            Ready to Start?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of writers already earning on WeWrite.
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create Your Free Account
          </Link>
        </div>
      </section>

      {/* Related Pages Section */}
      {relatedVerticals.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-accent/30">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-foreground mb-8">
              Explore More
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {relatedVerticals.map((vertical) => (
                <Link
                  key={vertical.slug}
                  href={`/welcome/${vertical.slug}`}
                  className="px-6 py-3 bg-card rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
                >
                  WeWrite for {vertical.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: usecase.metaTitle,
            description: usecase.metaDescription,
            url: `${PRODUCTION_URL}/for/${usecaseSlug}`,
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
