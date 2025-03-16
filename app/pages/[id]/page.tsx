"use client";

import SinglePageView from "../../components/SinglePageView";

export default function Page({ params }: { params: { id: string } }) {
  return <SinglePageView params={params} />;
} 