"use client";
import React, { useEffect, useState, useContext } from "react";
import { DataContext } from "../providers/DataProvider";
import { ReactSearchAutocomplete } from "react-search-autocomplete";
import { useRouter } from "next/navigation";
import { PillLink } from "./PillLink";

const Search = () => {
  const { filtered } = useContext(DataContext);
  const router = useRouter();

  const handleOnSelect = (item) => {
    router.push(`/pages/${item.id}`);
  }

  return (
    <div className="py-4 w-full">
      {/* <h1 className="text-2xl font-semibold">Search</h1> */}
      <ReactSearchAutocomplete
        items={filtered}
        onSearch={handleOnSearch}
        onSelect={handleOnSelect}
        autoFocus
        className="w-full bg-background text-text searchbar"
        placeholder="Search for a page"
        fuseOptions={{ 
          minMatchCharLength: 2,
        }}
        formatResult={(item) => {
          return (
            <PillLink href={`/pages/${item.id}`} isPublic={item.isPublic} key={item.id}>
              {item.name}
            </PillLink>
          );
        }}
      />
    </div>
  );
};

export default Search;
