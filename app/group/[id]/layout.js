import { fetchGroupFromFirebase } from "../../firebase/rtdb";

export async function generateMetadata({ params }) {
  const group = await fetchGroupFromFirebase(params.id);

  if (!group) {
    return {
      title: "Group Not Found",
      description: "This group does not exist.",
    };
  } else {
    return {
      title: group.name,
      description: group.description,
      openGraph: {
        title: group.name,
        description: group.description || 'A WeWrite group',
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/group/${params.id}`,
        siteName: 'WeWrite',
        type: 'group',
      },
      twitter: {
        card: 'summary',
        title: group.name,
        description: group.description || 'A WeWrite group',
      }
    };
  }
}

export default function GroupLayout({ children }) {
  return children;
}
