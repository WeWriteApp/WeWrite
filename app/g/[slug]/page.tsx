import { Metadata } from 'next';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import GroupPageClient from './GroupPageClient';

export const revalidate = 60;
export const dynamicParams = true;

interface Props {
  params: Promise<{ slug: string }>;
}

async function getGroupData(slug: string) {
  try {
    const admin = getFirebaseAdmin();
    if (!admin) return null;
    const db = admin.firestore();

    const snap = await db
      .collection(getCollectionName('groups'))
      .where('slug', '==', slug)
      .where('deleted', '!=', true)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const group = await getGroupData(slug);

  if (!group) {
    return { title: 'Group Not Found' };
  }

  return {
    title: `${(group as any).name} - WeWrite`,
    description: (group as any).description || `A group on WeWrite`,
  };
}

export default async function GroupPage({ params }: Props) {
  const { slug } = await params;
  const group = await getGroupData(slug);

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Group not found</h1>
          <p className="text-muted-foreground">
            This group doesn&apos;t exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  return <GroupPageClient initialGroup={group as any} />;
}
