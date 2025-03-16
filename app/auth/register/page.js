"use client";

import { useState, useEffect } from "react";
import { createUser, addUsername } from "../../firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../providers/AuthProvider";

export default function RegisterPage() {
  const router = useRouter();
  const [user, setUser] = useState({
    email: "",
    password: "",
    username: "",
  });
  const [error, setError] = useState(null);
  const { user: authUser } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (authUser) {
      router.push("/");
    }
  }, [authUser, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await createUser(user.email, user.password);
    if (response.code) {
      setError(response.message);
    } else {
      await addUsername(user.username);
      // Router push will happen automatically via the useEffect above
    }
  };

  return (
    <div className="container mx-auto md:max-w-lg md:mt-10">
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <h1 className="text-3xl font-bold mb-8 text-text">Register</h1>
        
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <div className="space-y-4">
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
                className="w-full p-3 rounded-md border border-border bg-light-background text-text placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="username"
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
                className="w-full p-3 rounded-md border border-border bg-light-background text-text placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="email"
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
                className="w-full p-3 rounded-md border border-border bg-light-background text-text placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!user.email || !user.password || !user.username}
              className="w-full bg-primary text-button-text p-3 rounded-md hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Register
            </button>

            <p className="text-center text-text">
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


