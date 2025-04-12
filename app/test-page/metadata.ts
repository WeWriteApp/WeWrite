import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Test Page',
  description: 'This is a test page with OpenGraph metadata.',
  openGraph: {
    title: 'Test Page',
    description: 'This is a test page with OpenGraph metadata.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Test Page',
    description: 'This is a test page with OpenGraph metadata.',
  },
};
