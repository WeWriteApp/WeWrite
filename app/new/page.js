"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "../DashboardLayout";
import { createPage } from "../firebase/database";
import PageHeader from "../components/PageHeader";
import ReactGA from 'react-ga4';
import { useWeWriteAnalytics } from "../hooks/useWeWriteAnalytics";
import { CONTENT_EVENTS } from "../constants/analytics-events";
import Cookies from 'js-cookie';
import PageEditor from "../components/PageEditor";
import { Button } from "../components/ui/button";
import { ChevronLeft } from "lucide-react";
import { createReplyAttribution } from "../utils/linkUtils";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import UnsavedChangesDialog from "../components/UnsavedChangesDialog";
import HydrationSafetyWrapper from "../components/HydrationSafetyWrapper";
import dynamic from 'next/dynamic';

// Dynamically import the entire page content to prevent SSR issues
const DynamicNewPageContent = dynamic(() => import("./NewPageContent"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="loader loader-lg"></div>
        <span className="text-lg text-muted-foreground">Loading editor...</span>
      </div>
    </div>
  )
});

export default function NewPage() {
  return (
    <DynamicNewPageContent />
  );
}

