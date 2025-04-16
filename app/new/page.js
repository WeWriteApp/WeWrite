import { redirect } from 'next/navigation';

// This page now redirects to the new /create page
export default function NewPage() {
  // Use a query parameter to indicate this is from the new page route
  redirect('/create?from=new');
}

