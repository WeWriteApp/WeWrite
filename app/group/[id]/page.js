import { fetchGroupFromFirebase } from "../../firebase/rtdb";
import GroupDetails from "../../components/GroupDetails";

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
      description: group.description || 'A WeWrite group',
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

export default async function GroupPage({ params }) {
  try {
    const group = await fetchGroupFromFirebase(params.id);

    if (!group) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <h1 className="text-2xl font-bold mb-4">Group Not Found</h1>
          <p className="text-muted-foreground">The group you're looking for doesn't exist.</p>
        </div>
      );
    }

    return <GroupDetails group={group} />;
  } catch (error) {
    console.error("Error loading group:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-muted-foreground">There was an error loading this group. Please try again later.</p>
      </div>
    );
  }
}
