import ComingSoonPage from "../components/ComingSoonPage";

export async function generateMetadata() {
  return {
    title: "Notifications - WeWrite",
    description: "Your WeWrite notifications"
  };
}

export default function NotificationsPage() {
  return (
    <ComingSoonPage
      title="Notifications Coming Soon"
      description="We're working on bringing you real-time notifications for mentions, comments, and page updates."
      icon="ph:bell-fill"
    />
  );
} 