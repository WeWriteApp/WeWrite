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
    <div className="flex items-center gap-2 mt-8 py-2 rounded-lg">
      <Button
        variant="outline"
        onClick={() => setIsEditing(!isEditing)}
      >
        {isEditing ? "Cancel" : "Edit"}
      </Button>
      <Button
        variant="destructive"
        onClick={handleDelete}
      >
        Delete
      </Button>
    </div>
  );
};

export default ActionRow