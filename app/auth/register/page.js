"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { createUser, addUsername } from "../../firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../providers/AuthProvider";
import Button from "../../components/Button";
import { Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [user, setUser] = useState({
    email: "",
    password: "",
    username: "",
  });
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="container mx-auto px-4">
      <div className="flex flex-col items-center justify-center min-h-[80vh] max-w-md mx-auto">
        <div className="w-full">
          <h1 className="text-3xl font-bold text-center mb-8">
            Register
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={user.username}
                onChange={(e) => setUser({ ...user, username: e.target.value })}
                placeholder="Enter your username"
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={user.email}
                onChange={(e) => setUser({ ...user, email: e.target.value })}
                placeholder="Enter your email"
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={user.password}
                  onChange={(e) => setUser({ ...user, password: e.target.value })}
                  placeholder="Enter your password"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500">
                {error}
              </p>
            )}

            <div className="w-full">
              <Button
                type="submit"
                className="w-full"
                variant="default"
              >
                Register
              </Button>
            </div>

            <div className="text-center text-sm">
              <span>Already have an account? </span>
              <Link href="/auth/login" className="text-blue-500 hover:text-blue-600 font-medium">
                Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


