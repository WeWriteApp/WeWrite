import { redirect } from 'next/navigation';

// CONSOLIDATION: This page redirects to the unified page creation route
export default function CreatePage() {
  // Redirect to the unified page creation route
  redirect('/new');
}
