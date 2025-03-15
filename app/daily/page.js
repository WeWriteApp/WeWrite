import ComingSoonPage from "../components/ComingSoonPage";

export async function generateMetadata() {
  return {
    title: "Daily Notes - WeWrite",
    description: "Your WeWrite daily notes"
  };
}

export default function DailyNotesPage() {
  return (
    <ComingSoonPage
      title="Daily Notes Coming Soon"
      description="Organize your thoughts with daily journal entries and notes."
      icon="ph:notebook-fill"
    />
  );
} 