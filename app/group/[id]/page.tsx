import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Canonical group route is /g/[id]. This page exists so that links using
 * /group/[id] (notifications, activity, search, etc.) resolve correctly.
 */
export default async function GroupRedirectPage({ params }: Props) {
  const { id } = await params;
  if (!id) redirect('/groups');
  redirect(`/g/${id}`);
}
