import { redirect } from 'next/navigation';

// This page now redirects to the new /create page
export default function NewPage() {
  redirect('/create');
}

