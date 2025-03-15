"use client";
import ComingSoonPage from "../components/ComingSoonPage";

export async function generateMetadata() {
  return {
    title: "Top Up - WeWrite",
    description: "Add funds to your WeWrite account"
  };
}

export default function TopUpPage() {
  return (
    <ComingSoonPage
      title="Top Up Coming Soon"
      description="Add funds to your account to support your favorite writers."
      icon="ph:currency-circle-dollar-fill"
    />
  );
} 