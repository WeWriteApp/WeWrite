"use client";
import React, { useEffect, useState } from "react";
import { getDocById } from "../../firebase/database";
import DashboardLayout from "../../DashboardLayout";
import TextView from "../../components/TextView";
import DonateBar from "../../components/DonateBar";
import TransactionsTable from "../../components/TransactionsTable";

const Page = ({ params }) => {
  const [page, setPage] = useState(null);
  const [editorState, setEditorState] = useState(null);

  useEffect(() => {
    if (!params.id) return;
    const fetchPage = async () => {
      const page = await getDocById("pages", params.id);
      setPage(page.data());
      console.log(page.data());
      setEditorState(page.data().content);
    };

    fetchPage();
  }, [params]);

  if (!page) {
    return <div>Loading...</div>;
  }
  return (
    <DashboardLayout>
      <div className="container mx-auto pt-20 mb-40">
        <h1 className="text-5xl font-semibold">{page.title}</h1>
        <Author
          author={{
            displayName: "gilgamesh2243",
            photoURL:
              "https://cdn.theorg.com/45fd5607-18f0-437b-a652-d790c63c5b2a_thumb.jpg",
          }}
        />
        <div className="flex w-full h-1 bg-gray-200 my-4"></div>
        <TextView content={editorState} />
        <DonateBar />

        {/* <div className="mt-8">
          <h2 className="text-2xl font-semibold">Transactions</h2>
          <TransactionsTable id={params.id} />
        </div> */}
      </div>
    </DashboardLayout>
  );
};

const Author = ({ author }) => {
  return (
    <div className="flex items-center gap-2 mt-4">
      <div className="flex items-center gap-2 border border-gray-200 py-2 px-4 rounded-full hover:bg-gray-100 cursor-pointer">
        <img
          src={author.photoURL}
          className="w-8 h-8 rounded-full"
          alt={author.displayName}
        />
        <span className="text-sm font-semibold">{author.displayName}</span>
      </div>
    </div>
  );
};

export default Page;
