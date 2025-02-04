"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePage } from "../firebase/database";
import { Icon } from "@iconify/react";

const ActionRow = ({ isEditing, setIsEditing, page }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async () => {
    let confirm = window.confirm("Are you sure you want to delete this page?");
    if (!confirm) return;
    const result = await deletePage(page.id);
    if (result) {
      router.push("/pages");
    } else {
      console.log("Error deleting page");
    }
  };

  return (
    <div className="relative">
      {/* Three-dot button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-200 transition-all"
      >
        <Icon icon="carbon:overflow-menu-vertical" className="text-gray-600 text-xl" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-32 bg-white shadow-lg border border-gray-300 rounded-lg z-10">
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-800"
            onClick={() => {
              setIsEditing(!isEditing);
              setIsOpen(false);
            }}
          >
            {isEditing ? "Cancel Edit" : "Edit"}
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-red-100 text-red-600"
            onClick={() => {
              handleDelete();
              setIsOpen(false);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ActionRow;