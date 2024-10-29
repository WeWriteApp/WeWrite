'use client'
import { loginUser } from "@/firebase/auth";
import { AppContext } from "@/providers/AppProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useState } from "react";
import toast from "react-hot-toast";

const LoginForm = () => {

  const router = useRouter();
  const [user, setUser] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState(null);
  const {setLoading} = useContext(AppContext)

  const handleChange = (e: any) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true)
    const response: any = await loginUser(user.email, user.password);
    setLoading(false)
    if (response?.code) {
      setError(response.message);
    } else {
      toast('Logged in!',
        {
          icon: '✔',
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
        })
      router.push("/");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        name="email"
        value={user.email}
        onChange={handleChange}
        placeholder="Email"
        autoComplete="off"
        className="border border-gray-300 rounded p-2 w-full bg-background text-text mt-2"
      />
      <input
        type="password"
        name="password"
        value={user.password}
        onChange={handleChange}
        placeholder="Password"
        autoComplete="new-password"
        className="border border-gray-300 rounded p-2 w-full bg-background text-text mt-2"
      />
      <button type="submit" className="bg-background text-button-text rounded p-2 w-full mt-2 border border-gray-300">
        Login
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}

      <p className="text-text mt-2">Don't have an account? <Link href="/auth/register" className="text-primary">Register</Link></p>
    </form>
  )
}

export default LoginForm