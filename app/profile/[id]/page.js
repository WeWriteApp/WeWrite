import SingleProfileView from "../../components/SingleProfileView";
import { fetchProfileFromFirebase } from "../../firebase/rtdb";

export async function generateMetadata({ params }) {
  const profile = await fetchProfileFromFirebase(params.id);

  if (!profile) {
    return {
      title: "Profile Not Found",
      description: "Profile not found"
    };
  } else {
    return {
      title: profile.username + " on WeWrite",
      description: profile.username,
    };
  }
}

export default async function Profile({ params }) {
  const profile = await fetchProfileFromFirebase(params.id);
  // Ensure profile exists before rendering the component
  if (!profile) {
    return <div>Profile not found</div>;
  }
  return <SingleProfileView profile={profile} />;
}
