import NewPageForm from "@/components/form/NewPageForm";


export async function generateMetadata() {
  return {
    title: "New Page",
    description: "Create new user Page",
  };
}


const NewPage = () => {

  return (
    <NewPageForm />
  );
};

export default NewPage