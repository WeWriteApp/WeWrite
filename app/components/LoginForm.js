"use client";
import { useState } from "react";
import { loginUser } from "../firebase/auth";
import Link from "next/link";
import { Icon } from "@iconify/react";

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await loginUser(formData.email, formData.password);
      if (response.code) { // Firebase error object has a code property
        setError(response.message);
      }
    } catch (error) {
      setError(error.message || 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <div className="mt-1">
            <input
              id="email"
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className="w-full px-3 py-2 border border-input rounded-md shadow-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <div className="mt-1">
            <input
              id="password"
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className="w-full px-3 py-2 border border-input rounded-md shadow-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2">
            <Icon icon="ph:warning-circle" className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center gap-2 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Icon icon="ph:circle-notch" className="w-5 h-5 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>

        <p className="text-sm text-center text-muted-foreground">
          Don't have an account?{' '}
          <Link href="/auth/register" className="text-primary hover:text-primary/90">
            Register
          </Link>
        </p>
      </form>
    </div>
  );
}