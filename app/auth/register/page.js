"use client";
import { createUser, addUsername } from "../../firebase/auth";
import { useState, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../../providers/AuthProvider";
import Link from "next/link";

const Register = () => {
  const router = useRouter();
  const { user, loading } = useContext(AuthContext);

  useEffect(() => {
    if (user) {
      router.push("/pages");
    }
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }
  return (
    <div className="container mx-auto md:max-w-lg mx-auto md:mt-10">
      <h1 className="text-2xl font-semibold mb-4">Register</h1>
      <Form />
    </div>
  );
}

const Form = () => {
  const router = useRouter();
  const [user, setUser] = useState({
    email: "",
    password: "",
    username: "",
  });

  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

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
    <form onSubmit={handleSubmit} className="flex flex-col">
      <input
        type="text"
        name="username"
        value={user.username}
        onChange={handleChange}
        placeholder="Username"
        className="border border-gray-300 rounded p-2 w-full mt-2 bg-background text-text"
      />
      <input
        type="email"
        name="email"
        value={user.email}
        onChange={handleChange}
        placeholder="Email"
        className="border border-gray-300 rounded p-2 w-full bg-background text-text mt-2"
      />
      
      <input
        type="password"
        name="password"
        value={user.password}
        onChange={handleChange}
        placeholder="Password"
        className="border border-gray-300 rounded p-2 w-full mt-2 bg-background text-text"
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

export default Register;