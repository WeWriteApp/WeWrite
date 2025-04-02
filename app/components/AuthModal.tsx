"use client";

import React from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import { LoginForm } from "./login-form"; // Assuming path is correct
import { RegisterForm } from "./register-form"; // Assuming path is correct

interface AuthModalProps {
  children: React.ReactNode; // Trigger element
  initialTab?: "login" | "register";
}

export function AuthModal({ children, initialTab = "login" }: AuthModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log In</TabsTrigger>
            <TabsTrigger value="register">Create Account</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
             {/* Apply padding directly if needed, remove intermediate div */}
             <LoginForm className="pt-4"/>
          </TabsContent>
          <TabsContent value="register">
             {/* Apply padding directly if needed, remove intermediate div */}
             <RegisterForm className="pt-4" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
