"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCurrentAccount } from '../../../providers/CurrentAccountProvider';
import { isAdmin } from '../../../utils/feature-flags';
import { PageLoader } from '../../../components/ui/page-loader';
import FeatureDetailPage from '../../../components/admin/FeatureDetailPage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { Button } from '../../../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ErrorCard } from '../../../components/ui/ErrorCard';

export default function FeatureDetail() {
  const router = useRouter();
  const params = useParams();
  const { session, isAuthenticated } = useCurrentAccount();
  const [isLoading, setIsLoading] = useState(true);
  const [featureData, setFeatureData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const featureId = params?.id as string;

  // Check if user is admin
  useEffect(() => {
    if (isAuthenticated && session) {
      if (!isAdmin(session.email)) {
        router.push('/');
      }
    } else if (!isAuthenticated) {
      router.push('/auth/login?redirect=/admin/features/' + featureId);
    }
  }, [session, isAuthenticated, router, featureId]);

  // Fetch feature data
  useEffect(() => {
    const fetchFeatureData = async () => {
      if (!featureId || !session) return;

      try {
        setIsLoading(true);

        // Get feature flags from Firestore
        const featureFlagsRef = doc(db, 'config', 'featureFlags');
        const featureFlagsDoc = await getDoc(featureFlagsRef);

        // Get feature metadata
        const featureMetaRef = doc(db, 'config', 'featureMetadata');
        const featureMetaDoc = await getDoc(featureMetaRef);

        if (featureFlagsDoc.exists()) {
          const flagsData = featureFlagsDoc.data();
          const metaData = featureMetaDoc.exists() ? featureMetaDoc.data() : {};

          // Get the specific feature metadata
          const featureMeta = metaData[featureId] || {
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            description: 'No description available'
          };

          setFeatureData({
            id: featureId,
            enabled: flagsData[featureId] === true,
            ...featureMeta
          });
        } else {
          setError('Feature flags not found');
        }
      } catch (err) {
        console.error('Error fetching feature data:', err);
        setError('Failed to load feature data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeatureData();
  }, [featureId, session]);

  if (isLoading || (session && !isAdmin(session.email))) {
    return <PageLoader message="Checking permissions..." />;
  }

  if (isLoading) {
    return <PageLoader message="Loading feature details..." />;
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/admin/tools" passHref>
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Button>
        </Link>
        <ErrorCard
          title="Error Loading Feature"
          message="Unable to load the requested feature details."
          error={error}
          onRetry={() => window.location.reload()}
          retryLabel="Retry"
        />
      </div>
    );
  }

  if (!featureData) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/admin/tools" passHref>
          <Button variant="outline" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Button>
        </Link>
        <div className="p-6 bg-muted rounded-2xl text-center">
          <h2 className="text-xl font-semibold">Feature Not Found</h2>
          <p className="mt-2">The requested feature could not be found.</p>
        </div>
      </div>
    );
  }

  return <FeatureDetailPage feature={featureData} />;
}