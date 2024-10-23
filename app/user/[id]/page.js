import SingleProfileView from "../../components/SingleProfileView";
import { fetchProfileFromFirebase } from "../../firebase/rtdb";

export async function generateMetadata({ params }) {
  const user = await fetchProfileFromFirebase(params.id);

  if (!user) {
    return {
      title: "Profile Not Found",
      description: "Profile not found"
    };
  } else {
    return {
      title: user.username + " on WeWrite",
      description: user.username,
    };
  }
}

export default async function User({ params }) {
  const user = await fetchProfileFromFirebase(params.id);
  // Ensure profile exists before rendering the component
  if (!user) {
    return <div>Profile not found</div>;
  }
  return <SingleProfileView profile={user} />;
}
