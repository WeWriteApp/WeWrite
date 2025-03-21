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
  const rtdb = getDatabase(app);
  const profileRef = ref(rtdb, `users/${params.id}`);
  const snapshot = await get(profileRef);
  
  if (!snapshot.exists()) {
    return <div>Profile not found</div>;
  }
  
  const userData = {
    uid: params.id,
    ...snapshot.val()
  };
  
  // We don't need to check auth here since we're making this page accessible to all
  return <SingleProfileView profile={userData} />;
}
