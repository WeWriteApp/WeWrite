"use client";

import { useState } from "react";
import { createUser, addUsername } from "../../firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [user, setUser] = useState({
    email: "",
    password: "",
    username: "",
  });
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await createUser(user.email, user.password);
    if (response.code) {
      setError(response.message);
    } else {
      await addUsername(user.username);
      router.push("/pages");
    }
  };

  return (
    <div className="container mx-auto md:max-w-lg md:mt-10">
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <h1 className="text-3xl font-bold mb-8 text-text">Register</h1>
        
        <form onSubmit={handleSubmit} className="w-full max-w-md">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-text font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                value={user.username}
                onChange={(e) => setUser({ ...user, username: e.target.value })}
                placeholder="Enter your username"
                required
                className="w-full p-3 rounded-md border border-border bg-background text-text placeholder-secondary"
              />
            </div>

            <div>
              <label className="block text-text font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                onChange={(e) => setUser({ ...user, email: e.target.value })}
                placeholder="Enter your email"
                required
                className="w-full p-3 rounded-md border border-border bg-background text-text placeholder-secondary"
              />
            </div>

            <div>
              <label className="block text-text font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={user.password}
                onChange={(e) => setUser({ ...user, password: e.target.value })}
                placeholder="Enter your password"
                required
                className="w-full p-3 rounded-md border border-border bg-background text-text placeholder-secondary"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm mt-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!user.email || !user.password || !user.username}
              className="w-full bg-primary text-button-text p-3 rounded-md hover:bg-primary-hover transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Register
            </button>

            <p className="text-center mt-4 text-text">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:text-primary-hover transition-colors">
                Login
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}


