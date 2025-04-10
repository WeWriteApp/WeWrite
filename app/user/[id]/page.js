import SingleProfileView from "../../components/SingleProfileView";
import { getDatabase, ref, get } from "firebase/database";
import { app } from "../../firebase/config";

// Revalidate the page every 5 seconds to get fresh data
export const revalidate = 5;

export async function generateMetadata({ params }) {
  const rtdb = getDatabase(app);
  const profileRef = ref(rtdb, `users/${params.id}`);
  const snapshot = await get(profileRef);

  if (!snapshot.exists()) {
    return {
      title: "Profile Not Found",
      description: "Profile not found"
    };
  } else {
    const userData = snapshot.val();
    return {
      title: (userData.username || userData.displayName) + " on WeWrite",
      description: userData.username || userData.displayName,
    };
  }
}

export default async function User({ params }) {
  try {
    const rtdb = getDatabase(app);
    const profileRef = ref(rtdb, `users/${params.id}`);
    const snapshot = await get(profileRef);

    if (!snapshot.exists()) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <h1 className="text-2xl font-bold mb-4">User Not Found</h1>
          <p className="text-muted-foreground">The user you're looking for doesn't exist.</p>
        </div>
      );
    }

    const userData = {
      uid: params.id,
      ...snapshot.val()
    };

    // We don't need to check auth here since we're making this page accessible to all
    return <SingleProfileView profile={userData} />;
  } catch (error) {
    console.error("Error loading user profile:", error);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-muted-foreground">There was an error loading this user profile. Please try again later.</p>
      </div>
    );
  }
}
