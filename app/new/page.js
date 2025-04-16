import { redirect } from 'next/navigation';

// This page now redirects to the direct create page
export default function NewPage() {
  // Redirect to the direct create page
  redirect('/direct-create');
}

