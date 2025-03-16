"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Container, Flex, Text, Button, TextField } from '@radix-ui/themes';
import { auth } from "../firebase/config";

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
      <form onSubmit={handleSubmit}>
        <Flex direction="column" gap="4">
          <Box>
            <Text as="label" size="2" mb="2" weight="bold">
              Email
            </Text>
            <TextField
              size="3"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoFocus
              className="hover:border-primary focus:border-primary transition-colors"
            />
          </Box>

          <Box>
            <Text as="label" size="2" mb="2" weight="bold">
              Password
            </Text>
            <TextField
              size="3"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="hover:border-primary focus:border-primary transition-colors"
            />
          </Box>

          {error && (
            <Text color="red" size="2">
              {error}
            </Text>
          )}

          <Button type="submit" size="3" className="bg-primary text-primary-foreground hover:bg-primary/90">
            Login
          </Button>

          <Flex justify="center" gap="2">
            <Text size="2">Don't have an account?</Text>
            <Link href="/auth/register">
              <Text size="2" className="text-blue-500 hover:text-blue-600 transition-colors">
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