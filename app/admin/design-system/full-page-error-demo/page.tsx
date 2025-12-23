"use client";

import FullPageError from '../../../components/ui/FullPageError';
import { useRouter } from 'next/navigation';

export default function FullPageErrorDemoPage() {
  const router = useRouter();

  return (
    <FullPageError
      error={new Error("This is a demo error message for testing purposes. The component displays error details, provides action buttons, and allows copying error info to clipboard.")}
      title="Something went wrong"
      message="We're sorry, but there was an error loading this page."
      onRetry={() => router.push('/admin/design-system#full-page-error')}
    />
  );
}
