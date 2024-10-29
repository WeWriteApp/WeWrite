import NewGroupForm from "@/components/form/NewGroupForm";

export async function generateMetadata() {
  return {
    title: "New Group",
    description: "Create new user Group",
  };
}


const NewGroup = () => {

  return (
    <NewGroupForm />
  );
};

export default NewGroup