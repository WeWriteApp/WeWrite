import ComingSoonPage from "../components/ComingSoonPage";

export async function generateMetadata() {
  return {
    title: "Activity - WeWrite",
    description: "Your WeWrite activity feed"
  };
}

export default function ActivityPage() {
  return (
    <ComingSoonPage
      title="Activity Feed Coming Soon"
      description="Track your writing progress, contributions, and interactions with other writers."
      icon="ph:activity-fill"
      docsLink="Ayfgr1uNDjvDKGQDgoMm"
    />
  );
} 