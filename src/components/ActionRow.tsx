"use client";
import { useRouter } from "next/navigation";
import { deletePage } from "../firebase/database";

const ActionRow = ({ isEditing, setIsEditing, page }: any) => {
  const router = useRouter();
  const handleDelete = async () => {
    let confirm = window.confirm("Are you sure you want to delete this page?");

    if (!confirm) return;
    const result = await deletePage(page.id);
    if (result) {
      router.push("/");
    } else {
      console.log("Error deleting page");
    }
  };

  return (
    <div className="flex items-center gap-2 mt-8 border-t border-gray-500 py-2 rounded-lg">
      <button
        className="bg-background text-button-text  px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
        onClick={() => setIsEditing(!isEditing)}
      >
        {isEditing ? "Cancel" : "Edit"}
      </button>
      <button
        onClick={handleDelete}
        className="bg-background border-gray-500 border text-button-text px-4 py-2 rounded-lg hover:bg-red-700 transition-colors hover:text-white"
      >
        Delete
      </button>
    </div>
  );
};

export default ActionRow