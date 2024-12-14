"use client";

import { useState } from "react";
import { loginUser } from "../firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

const LoginForm = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await loginUser(user.email, user.password);
      if (response.user) {
        router.push("/pages");
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        name="email"
        value={user.email}
        onChange={handleChange}
        placeholder="Email"
        autoComplete="off"
        disabled={loading}
        className="border border-gray-300 rounded p-2 w-full bg-background text-text mt-2 disabled:opacity-50"
      />
      <input
        type="password"
        name="password"
        value={user.password}
        onChange={handleChange}
        placeholder="Password"
        autoComplete="off"
        disabled={loading}
        className="border border-gray-300 rounded p-2 w-full bg-background text-text mt-2 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-background text-button-text rounded p-2 w-full mt-2 border border-gray-300 disabled:opacity-50 relative"
      >
        {loading ? (
          <>
            <span className="opacity-0">Login</span>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-900"></div>
            </div>
          </>
        ) : (
          'Login'
        )}
      </button>
      {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      <p className="text-text mt-2">
        Don't have an account? <Link href="/auth/register" className="text-primary">Register</Link>
      </p>
    </form>
  );
};

export default LoginForm;
