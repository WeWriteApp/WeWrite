"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/config";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/pages");
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="container mx-auto md:max-w-lg md:mt-10">
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <h1 className="text-3xl font-bold mb-8 text-text">Login</h1>
        
        <form onSubmit={handleSubmit} className="w-full max-w-md">
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-text font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              className="w-full bg-primary text-button-text p-3 rounded-md hover:bg-primary-hover transition-colors mt-4"
            >
              Login
            </button>

            <p className="text-center mt-4 text-text">
              Don't have an account?{" "}
              <Link href="/auth/register" className="text-primary hover:text-primary-hover transition-colors">
                Register
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}


