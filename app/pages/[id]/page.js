import SinglePageView from "../../components/SinglePageView";
import { getPageById } from "../../firebase/database";

export async function generateMetadata({ params }) {
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
}

const Page = async ({ params }) => {
  return (
    <SinglePageView params={params} />
  );
};

export default Page;

