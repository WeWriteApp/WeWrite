"use client";

import { notFound } from 'next/navigation';

export default function NotFoundWrapper(): null {
  // This is a client component wrapper that calls notFound()
  // It's used to trigger the not-found.tsx page from client components
  notFound();
  return null;
}
