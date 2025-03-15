import ComingSoonPage from "../components/ComingSoonPage";

export async function generateMetadata() {
  return {
    title: "Daily Notes - WeWrite",
    description: "Your WeWrite daily notes"
  };
}

export default function DailyPage() {
  return (
    <ComingSoonPage
      title="Daily Notes Coming Soon"
      description="Get daily writing prompts and track your daily writing progress."
      icon="ph:note-fill"
    />
  );
} 