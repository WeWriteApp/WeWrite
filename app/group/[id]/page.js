import { fetchGroupFromFirebase } from "../../firebase/rtdb";
import GroupProfileView from "../../components/GroupProfileView";
import { Loader } from "lucide-react";

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
      description: group.description || `${group.name} - A collaborative group on WeWrite`,
    };
  }
}

export default async function Page({ params }) {
  const group = await fetchGroupFromFirebase(params.id);

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl">
      <GroupProfileView group={group} />
    </div>
  );
}
