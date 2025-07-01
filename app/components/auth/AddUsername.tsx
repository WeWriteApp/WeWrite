"use client";
import { useCurrentAccount } from "../../providers/CurrentAccountProvider";
import { useState } from "react";
import { addUsername } from "../../firebase/auth";
import { useRouter } from "next/navigation";
import { userNeedsUsername } from "../../utils/usernameValidation";

const AddUsername = () => {
  const { session } = useCurrentAccount();
  const [username, setUsername] = useState("");
  const [confirmUsername, setConfirmUsername] = useState("");
  const router = useRouter();

  const handleChange = (e) => {
    setUsername(e.target.value);
  };

  // Use centralized username validation logic
  if (!userNeedsUsername(session)) {
    return null;
  }
  return (
    <>
    {
      userNeedsUsername(session) && (
    <div className="bg-blue-100 p-4">
      <label
        htmlFor="username"
        className="block text-sm font-medium text-gray-700"
      >
        Please add your username
      </label>
      <div className="flex flex-row items-center space-x-4">
      <input
        type="text"
        name="username"
        placeholder="Username"
        className="mt-1 block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md py-4"
        value={username}
        onChange={handleChange}
        autoComplete="off"
      />
      <input
        type="text"
        name="confirmUsername"
        placeholder="Confirm Username"
        value={confirmUsername}
        className="mt-1 block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md py-4"
        onChange={(e) => setConfirmUsername(e.target.value)}
        autoComplete="off"
      />
      <button
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        disabled={username !== confirmUsername}
        onClick={async() => {
          try {
            const result = await addUsername(session.uid, username);
            if (result.success) {
              // Username was successfully added, the page should refresh automatically
              // due to the auth state change, but we can also redirect manually
              router.push("/");
            } else {
              console.error('Failed to add username:', result.error);
            }
          } catch (error) {
            console.error('Error adding username:', error);
          }
        }}
      >
        Add Username
      </button>
      </div>

    </div>
      )
     }
    </>
  );
}

export default AddUsername;