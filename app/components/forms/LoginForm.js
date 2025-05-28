"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Container, Flex, Text, Button, TextField } from '@radix-ui/themes';
import { auth } from "../../firebase/config";

const LoginForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <Container size="1">
      <div className="flex flex-col items-center gap-2 text-center mb-6">
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-balance text-sm text-white !important">
          Enter your email below to login to your account
        </p>
      </div>
      <form onSubmit={handleSubmit}>
        <Flex direction="column" gap="4">
          <Box>
            <Text as="label" size="2" mb="2" weight="bold" className="text-white !important">
              Email
            </Text>
            <TextField
              size="3"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="text-white !important bg-white/10 border-white/20 placeholder:text-white/50"
            />
          </Box>

          <Box>
            <Text as="label" size="2" mb="2" weight="bold" className="text-white !important">
              Password
            </Text>
            <TextField
              size="3"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="text-white !important bg-white/10 border-white/20 placeholder:text-white/50"
            />
          </Box>

          {error && (
            <Text className="text-sm font-medium text-red-400 !important">
              {error}
            </Text>
          )}

          <Button 
            type="submit" 
            size="3" 
            variant="solid" 
            className="w-full bg-white text-blue-950 hover:bg-white/90"
          >
            Login
          </Button>

          <Flex justify="center" gap="2" className="text-center text-sm text-white/80 !important">
            <Text>Don't have an account?</Text>
            <Link href="/auth/register">
              <Text className="underline underline-offset-4 text-white !important hover:text-white/90">
                Register
              </Text>
            </Link>
          </Flex>
        </Flex>
      </form>
    </Container>
  );
};

export default LoginForm;