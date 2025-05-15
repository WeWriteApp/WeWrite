import { fetchGroupFromFirebase } from "../../firebase/rtdb";
import GroupProfileView from "../../components/GroupProfileView";
import { Loader } from "lucide-react";
import { redirect } from "next/navigation";
import { isAdmin } from "../../utils/feature-flags";
import { cookies } from "next/headers";

export async function generateMetadata({ params }) {
  // Check if the groups feature is enabled
  const cookieStore = cookies();
  const userEmail = cookieStore.get("user_email")?.value;
  const groupsFeatureEnabled = cookieStore.get("feature_groups")?.value === "true";
  const isUserAdmin = isAdmin(userEmail);

  // If the feature is disabled or user is not an admin, return generic metadata
  if (!isUserAdmin || !groupsFeatureEnabled) {
    return {
      title: "WeWrite",
      description: "Create, collaborate, and share your writing with others in real-time",
    };
  }

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
  // Check if the groups feature is enabled
  const cookieStore = cookies();
  const userEmail = cookieStore.get("user_email")?.value;
  const groupsFeatureEnabled = cookieStore.get("feature_groups")?.value === "true";
  const isUserAdmin = isAdmin(userEmail);

  // If the feature is disabled or user is not an admin, redirect to home
  if (!isUserAdmin || !groupsFeatureEnabled) {
    console.log(`[DEBUG] Group page - Feature disabled or non-admin user, redirecting to home. Admin: ${isUserAdmin}, Feature enabled: ${groupsFeatureEnabled}`);
    redirect('/');
  }

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
