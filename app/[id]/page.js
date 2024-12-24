import SinglePageView from "../components/SinglePageView";
import { getPageById } from "../firebase/database";

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
      title: pageData.title,
      description: "A page"
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: "Error",
      description: "An error occurred"
    };
  }
}

const Page = async ({ params }) => {
  return (
    <SinglePageView params={params} />
  );
};

export default Page;

