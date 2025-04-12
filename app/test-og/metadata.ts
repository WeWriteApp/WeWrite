import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OpenGraph Test Page',
  description: 'This is a test page for OpenGraph images',
  openGraph: {
    title: 'OpenGraph Test Page',
    description: 'This is a test page for OpenGraph images',
    type: 'website',
    url: 'https://wewrite.vercel.app/test-og',
    images: [
      {
        url: 'https://wewrite.vercel.app/api/og/static',
        width: 1200,
        height: 630,
        alt: 'OpenGraph Test Image',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenGraph Test Page',
    description: 'This is a test page for OpenGraph images',
    images: ['https://wewrite.vercel.app/api/og/static'],
  },
};
