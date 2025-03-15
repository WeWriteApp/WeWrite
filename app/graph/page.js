import ComingSoonPage from "../components/ComingSoonPage";

export async function generateMetadata() {
  return {
    title: "Graph View - WeWrite",
    description: "Visualize your WeWrite pages"
  };
}

export default function GraphViewPage() {
  return (
    <ComingSoonPage
      title="Graph View Coming Soon"
      description="Visualize connections between your pages in an interactive graph."
      icon="ph:graph-fill"
    />
  );
} 