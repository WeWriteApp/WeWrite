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
  const { pageData, versionData, links } = await getPageById(params.id);

  if (!pageData) {
    return (
      <div>
        <h1>Page Not Found</h1>
        <p>This page does not exist</p>
      </div>
    );
  }
  return (
    <SinglePageView pageData={pageData} versionData={versionData} links={links} />
  );
};

export default Page;

