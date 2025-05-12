import { fetchGroupFromFirebase } from "../../firebase/rtdb";
import GroupDetails from "../../components/GroupDetails";

export async function generateMetadata({ params }) {
  // Explicitly await the params object before destructuring
  const resolvedParams = await params;
  const id = resolvedParams.id;

  // Fetch group data
  const group = await fetchGroupFromFirebase(id);

  if (!group) {
    return {
      title: "Group Not Found",
      description: "This group does not exist.",
    };
  } else {
    return {
      title: group.name,
      description: group.description,
    };
  }
}

export default async function Page({ params }) {
  // Explicitly await the params object before destructuring
  const resolvedParams = await params;
  const id = resolvedParams.id;

  // Fetch group data
  const group = await fetchGroupFromFirebase(id);

  if (!group) return <div className="flex items-center justify-center h-screen"><div className="loader loader-lg"></div></div>;

  return (
    <GroupDetails group={group} />
  );
}


