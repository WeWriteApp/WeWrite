"use client";

import React, { useState } from "react";
import { Button } from "../ui/button";
import Modal from "../ui/modal";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import { LoginForm } from "./login-form"; // Assuming path is correct
import { RegisterForm } from "./register-form"; // Assuming path is correct

interface AuthModalProps {
  children: React.ReactNode; // Trigger element
  initialTab?: "login" | "register";
}

export function AuthModal({ children, initialTab = "login" }: AuthModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger element */}
      {React.cloneElement(children as React.ReactElement, {
        onClick: () => setIsOpen(true)
      })}

      {/* Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="sm:max-w-[425px] p-4"
        showCloseButton={false}
      >
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log In</TabsTrigger>
            <TabsTrigger value="register">Create Account</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
             <LoginForm className="pt-2"/>
          </TabsContent>
          <TabsContent value="register">
             <RegisterForm className="pt-2" />
          </TabsContent>
        </Tabs>
      </Modal>
    </>
  );
}
