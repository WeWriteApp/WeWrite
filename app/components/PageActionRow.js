"use client";
import { useRouter } from "next/navigation";
import { deletePage} from "../firebase/database";
import Button from "./Button";

const ActionRow = ({ isEditing, setIsEditing, page }) => {
  const router = useRouter();
  const handleDelete = async () => {
    let confirm = window.confirm("Are you sure you want to delete this page?");

    if (!confirm) return;
    const result = await deletePage(page.id);
    if (result === true) {
      router.push("/");
    } else {
      console.error("Error deleting page:", result);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-8 border-t border-gray-500 py-2 rounded-lg">
      <Button
        variant="ghost"
        onClick={() => setIsEditing(!isEditing)}
      >
        {isEditing ? "Cancel" : "Edit"}
      </Button>
      <Button
        variant="ghost"
        onClick={handleDelete}
        className="hover:bg-red-700 hover:text-white"
      >
        Delete
      </Button>
    </div>
  );
};

export default ActionRow;