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
      <div className="container mx-auto py-8">
        <SettingsPage />
      </div>
    </DashboardLayout>
  );
}
