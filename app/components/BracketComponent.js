"use client";
import { useContext, useState, useEffect, useRef } from "react";
import { DataContext } from "../providers/DataProvider";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { INSERT_CUSTOM_LINK_COMMAND } from "./CustomLinkPlugin";

function BracketComponent() {
  const { pages, loading } = useContext(DataContext);
  const [inputValue, setInputValue] = useState("");
  const [filteredPages, setFilteredPages] = useState(pages);
  const containerRef = useRef(null);
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        // Hide the component (can use a state or context to handle this)
        containerRef.current.style.display = 'none';
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [containerRef]);

  useEffect(() => {
    setFilteredPages(
      pages.filter((page) =>
        page.title.toLowerCase().includes(inputValue.toLowerCase())
      )
    );
  }, [inputValue, pages]);

  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const handlePageClick = (page) => {
    const url = `/page/${page.id}`;
    const text = page.title;

    if (!url || !text) {
      console.error('URL or text is undefined');
      return;
    }

    editor.dispatchCommand(INSERT_CUSTOM_LINK_COMMAND, { url, text });

    // Use an effect to hide the component after a slight delay to avoid state update during render
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.display = 'none';
      }
    }, 0);
  };

  return (
    <div ref={containerRef} className="relative bg-white shadow-md rounded-md p-4 w-64">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder="Create or select a page..."
        className="w-full p-2 border border-gray-300 rounded-md"
        autoComplete="off"
      />
      {filteredPages.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md">
          {filteredPages.map((page) => (
            <li
              key={page.id}
              className="p-2 hover:bg-gray-200 cursor-pointer"
              onClick={() => handlePageClick(page)}
            >
              {page.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BracketComponent;
