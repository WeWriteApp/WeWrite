"use client";

import { PageHeader } from "../components/PageHeader";
import { useRouter } from "next/navigation";

export default function TestPage() {
  const router = useRouter();

  return (
    <div>
      <PageHeader 
        title="My First Document"
        author="James Gray"
        onBack={() => router.back()}
      />
      
      {/* Add some content to enable scrolling */}
      <div className="mt-24 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <h2 className="text-xl font-semibold">Section {i + 1}</h2>
              <p className="text-muted-foreground">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis 
                nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 