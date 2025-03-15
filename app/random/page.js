import ComingSoonPage from "../components/ComingSoonPage";

export async function generateMetadata() {
  return {
    title: "Random Page - WeWrite",
    description: "Discover random WeWrite pages"
  };
}

export default function RandomPage() {
  return (
    <ComingSoonPage
      title="Random Page Coming Soon"
      description="Discover interesting pages through random exploration."
      icon="ph:dice-five-fill"
    />
  );
} 