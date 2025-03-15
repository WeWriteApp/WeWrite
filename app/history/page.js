import ComingSoonPage from "../components/ComingSoonPage";

export async function generateMetadata() {
  return {
    title: "History - WeWrite",
    description: "Your WeWrite page history"
  };
}

export default function HistoryPage() {
  return (
    <ComingSoonPage
      title="Page History Coming Soon"
      description="View and restore previous versions of your pages."
      icon="ph:clock-clockwise-fill"
      docsLink="3AszVcuJkFh1FsvYmKM8"
    />
  );
} 