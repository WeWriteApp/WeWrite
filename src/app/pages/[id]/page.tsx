import SinglePageView from "@/components/page/SinglePageView";
import { getPageById } from "@/firebase/database";

export async function generateMetadata({params}: any) {

  const { id } = await params
  const pageData: any = await getPageById(id);
  console.log(pageData);

  if (!pageData) {
    return {
      title: "Page Not Found",
      description: "This page does not exist"
    };
  }

  return {
    title: pageData.title,
    description: "page"
  };
}

const Page = async () => {
  return (
    <SinglePageView />
  );
};

export default Page;

