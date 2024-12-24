import DashboardLayout from "../DashboardLayout";
import BillingPage from "../components/BillingPage";
import SubscriptionsTable from "../components/SubscriptionsTable";

export async function generateMetadata({ params }) {
  return {
    title: "Settings",
    description: "User settings"
  };
}

const Page = () => {
  return (
    <DashboardLayout>
      <div className="container mx-auto pt-10 pb-20">
        <h1 className="text-2xl font-semibold mb-8">Settings</h1>

        <div className="space-y-12">
          <section>
            <h2 className="text-xl font-medium mb-4">Page Subscriptions</h2>
            <p className="text-gray-600 mb-4">Manage how your monthly subscription is allocated across different pages.</p>
            <SubscriptionsTable />
          </section>

          <section>
            <h2 className="text-xl font-medium mb-4">Billing Settings</h2>
            <BillingPage />
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Page;
