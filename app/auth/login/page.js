"use client";
import { loginUser } from "../../firebase/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";

const Login = () => {
  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Login</h1>
      <Form />
    </div>
  );
}

const Form = () => {
  const router = useRouter();
  const [user, setUser] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await loginUser(user.email, user.password);
    if (response.code) {
      setError(response.message);
    } else {
      router.push("/pages");
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
        className="border border-gray-300 rounded p-2 w-full"
      />
      <input
        type="password"
        name="password"
        value={user.password}
        onChange={handleChange}
        placeholder="Password"
        className="border border-gray-300 rounded p-2 w-full mt-2"
      />
      <button type="submit" className="bg-blue-500 text-white rounded p-2 w-full mt-2">
        Login
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
    </form>
  );
};

export default Login;