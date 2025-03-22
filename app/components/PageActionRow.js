"use client";
import { useRouter } from "next/navigation";
import { deletePage} from "../firebase/database";
import { Button } from "./ui/button";

const ActionRow = ({ isEditing, setIsEditing, page }) => {
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
    <div className="flex items-center justify-end gap-3 mt-8 py-2 rounded-lg">
      <Button
        variant="outline"
        onClick={() => setIsEditing(!isEditing)}
        className="px-4 py-2"
      >
        {isEditing ? "Cancel" : "Edit"}
      </Button>
      <Button
        variant="destructive"
        onClick={handleDelete}
        className="px-4 py-2"
      >
        Delete
      </Button>
    </div>
  );
};

export default ActionRow