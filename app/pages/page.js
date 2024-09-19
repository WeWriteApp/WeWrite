import Dashboard from "../components/Dashboard";

export async function generateMetadata() {
  return {
    title: "Your WeWrite",
    description: "Your WeWrite dashboard",
  };
}

const Page = () => {
  return (
    <Dashboard />
  );
};

export default Page;
