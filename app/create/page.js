import { redirect } from 'next/navigation';

// This page now redirects to the direct create page
export default function CreatePage() {
  // Redirect to the direct create page
  redirect('/new');
}
