"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase/config";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Container, Flex, Text, Button, TextField } from '@radix-ui/themes';

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
    <Container size="1">
      <Flex direction="column" gap="4" justify="center" style={{ minHeight: '80vh' }}>
        <Box mb="4">
          <Text size="8" weight="bold" align="center">
            Login
          </Text>
        </Box>

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
              />
            </Box>

            {error && (
              <Text color="red" size="2">
                {error}
              </Text>
            )}

            <Button type="submit" size="3">
              Login
            </Button>

            <Flex justify="center" gap="2">
              <Text size="2">Don't have an account?</Text>
              <Link href="/auth/register">
                <Text size="2" color="blue">
                  Register
                </Text>
              </Link>
            </Flex>
          </Flex>
        </form>
      </Flex>
    </Container>
  );
}


