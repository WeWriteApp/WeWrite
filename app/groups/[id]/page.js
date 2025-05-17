"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";

export default function GroupRedirectPage({ params }) {
  const router = useRouter();
  const { id } = params;

  useEffect(() => {
    // Redirect to the correct group page
    if (id) {
      console.log('Groups redirect page - redirecting to group page', {
        groupId: id,
        url: `/group/${id}`
      });

      try {
        // Create a full URL to ensure proper navigation
        const baseUrl = window.location.origin;
        const fullUrl = `${baseUrl}/group/${id}`;
        console.log('Groups redirect page - Navigating to full URL:', fullUrl);

        // Use window.location.href for more reliable navigation
        window.location.href = fullUrl;
      } catch (error) {
        console.error('Error with navigation, falling back to direct href', error);
        window.location.href = `/group/${id}`;
      }
    }
  }, [id]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
