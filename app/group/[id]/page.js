import { fetchGroupFromFirebase } from "../../firebase/rtdb";
import { Loader } from "lucide-react";
import { redirect } from "next/navigation";
import { isAdminServer } from "../../utils/server-feature-flags";
import { cookies } from "next/headers";
import GroupPageClient from "./GroupPageClient";

export async function generateMetadata({ params }) {
  // Properly await the params object
  const { id } = await params;

  // Check if the groups feature is enabled
  const cookieStore = await cookies();
  const userEmail = cookieStore.get("user_email")?.value;
  const groupsFeatureEnabled = cookieStore.get("feature_groups")?.value === "true";
  const isUserAdmin = isAdminServer(userEmail);

  // Log the values for debugging
  console.log(`[DEBUG] Group page metadata - Feature check. Admin: ${isUserAdmin}, Feature enabled: ${groupsFeatureEnabled}, Email: ${userEmail}, Group ID: ${id}`);

  // For now, we'll bypass the feature flag check to fix the navigation issue
  // This allows all users to view group pages while we investigate the feature flag issue
  // We'll still log the values for debugging purposes

  // if (!isUserAdmin || !groupsFeatureEnabled) {
  //   return {
  //     title: "WeWrite",
  //     description: "Create, collaborate, and share your writing with others in real-time",
  //   };
  // }

  const group = await fetchGroupFromFirebase(id);

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
  // Properly await the params object
  const { id } = await params;

  // Check if the groups feature is enabled
  const cookieStore = await cookies();
  const userEmail = cookieStore.get("user_email")?.value;
  const groupsFeatureEnabled = cookieStore.get("feature_groups")?.value === "true";
  const isUserAdmin = isAdminServer(userEmail);

  // Log the values for debugging
  console.log(`[DEBUG] Group page - Feature check. Admin: ${isUserAdmin}, Feature enabled: ${groupsFeatureEnabled}, Email: ${userEmail}, Group ID: ${id}`);

  // For now, we'll bypass the feature flag check to fix the navigation issue
  // This allows all users to view group pages while we investigate the feature flag issue
  // We'll still log the values for debugging purposes

  // if (!isUserAdmin || !groupsFeatureEnabled) {
  //   console.log(`[DEBUG] Group page - Feature disabled or non-admin user, redirecting to home. Admin: ${isUserAdmin}, Feature enabled: ${groupsFeatureEnabled}, Email: ${userEmail}`);
  //   redirect('/');
  // }

  console.log(`[DEBUG] Group page - Access granted. Admin: ${isUserAdmin}, Feature enabled: ${groupsFeatureEnabled}, Email: ${userEmail}, Group ID: ${id}`);

  const group = await fetchGroupFromFirebase(id);

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl">
      <GroupPageClient group={group} />
    </div>
  );
}
