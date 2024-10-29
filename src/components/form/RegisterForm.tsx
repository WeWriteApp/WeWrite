"use client";
import { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addUsername, createUser } from "@/firebase/auth";
import toast from "react-hot-toast";
import { AppContext } from "@/providers/AppProvider";

const RegisterForm = () => {
  const router = useRouter();
  const [user, setUser] = useState({
    email: "",
    password: "",
    username: "",
  });

  const [error, setError] = useState(null);
  const { setLoading } = useContext(AppContext)

  const handleChange = (e: any) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true)
    const response: any = await createUser(user.email, user.password);
    setLoading(false)
    if (response.code) {
      setError(response.message);

    } else {
      await addUsername(user.username);
      toast('Registered!',
        {
          icon: '✔',
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        }
      );
      router.push("/");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <input
        type="text"
        name="username"
        value={user.username}
        onChange={handleChange}
        placeholder="Username"
        className="border border-gray-300 rounded p-2 w-full mt-2 bg-background text-text"
        autoComplete="off"
      />
      <input
        type="email"
        name="email"
        value={user.email}
        onChange={handleChange}
        placeholder="Email"
        className="border border-gray-300 rounded p-2 w-full bg-background text-text mt-2"
        autoComplete="off"
      />

      <input
        type="password"
        name="password"
        value={user.password}
        onChange={handleChange}
        placeholder="Password"
        className="border border-gray-300 rounded p-2 w-full mt-2 bg-background text-text"
        autoComplete="new-password"
      />

      <button
        disabled={!user.email || !user.password || !user.username}
        type="submit"
        className={`bg-background text-button-text rounded p-2 w-full mt-2 border border-gray-300 ${!user.email || !user.password || !user.username ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        Register
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}

      <p className="text-text mt-2">Already have an account? <Link href="/auth/login" className="text-primary">Login</Link></p>
    </form>
  );
};

export default RegisterForm;