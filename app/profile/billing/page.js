import DashboardLayout from "../../DashboardLayout";
import BillingPage from "../../components/BillingPage";

export async function generateMetadata({ params }) {
  return {
    title: "Billing",
    description: "Billing and subscription settings"
  };
}

export default function BillingPageWrapper() {  
  return (
    <DashboardLayout>
      <div className="container mx-auto pt-10">
        <BillingPage />        
      </div>
    </DashboardLayout>
  );
}
