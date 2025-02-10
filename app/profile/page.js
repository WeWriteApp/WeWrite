import DashboardLayout from "../DashboardLayout";
import SettingsPage from "../components/BillingPage";


export async function generateMetadata({ params }) {
  return {
    title: "Settings",
    description: "User settings"
  };
}


const Page = () => {  
  return (
    <DashboardLayout>
    </DashboardLayout>
  );
};



export default Page;
