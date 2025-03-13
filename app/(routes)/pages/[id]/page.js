import SinglePageView from "@/app/components/SinglePageView";
import { getPageById } from "@/app/firebase/database";

export async function generateMetadata({ params }) {
  try {
    const { pageData } = await getPageById(params.id);

    if (!pageData) {
      return {
        title: "Page Not Found",
        description: "This page does not exist"
      };
    }

    return {
      title: pageData.title || "Untitled Page",
      description: pageData.description || "A WeWrite page"
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: "Error Loading Page",
      description: "There was an error loading this page"
    };
  }
}

export default async function PageRoute({ params }) {
  // Pre-fetch the initial page data
  const { pageData } = await getPageById(params.id);
  
  // Pass both the ID and initial data to the client component
  return <SinglePageView id={params.id} initialData={pageData} />;
} 