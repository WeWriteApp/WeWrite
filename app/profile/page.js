import DashboardLayout from "../DashboardLayout";
import SettingsPage from "../components/BillingPage";

export async function generateMetadata({ params }) {
  return {
    title: "Settings",
    description: "User settings"
  };
}

export default function ProfilePage() {  
  return (
    <DashboardLayout>
      <div className="container mx-auto pt-10">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <SettingsPage />
      </div>
    </DashboardLayout>
  );
}
