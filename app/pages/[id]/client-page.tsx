"use client";

import SinglePageView from "../../components/SinglePageView";

export default function ClientPage({ params }: { params: { id: string } }) {
  return <SinglePageView params={params} />;
}
