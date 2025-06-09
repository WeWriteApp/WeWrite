"use client";

import { use } from "react";
import SinglePageView from "../../components/pages/SinglePageView";

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params Promise using React.use()
  const { id } = use(params);
  const validParams = { id: id || '' };
  return <SinglePageView params={validParams} />;
}
