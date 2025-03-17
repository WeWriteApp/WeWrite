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
      <div className="container mx-auto">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <SettingsPage />
        
      </div>
    </DashboardLayout>
  );
};



export default Page;
