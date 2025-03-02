"use client";
import Modal from "./Modal";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";
import { useState } from "react";

export default function AuthModal({ isOpen, onClose }) {
    const [activeTab, setActiveTab] = useState("login");
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Welcome to our community">
            <div className="flex items-center justify-center gap-4">
                <button
                    className={`${activeTab === "login"
                            ? "text-primary font-semibold"
                            : "text-text"
                        }`}
                    onClick={() => setActiveTab("login")}
                >
                    Login

                </button>
                <button
                    className={`${activeTab === "register"
                            ? "text-primary font-semibold"
                            : "text-text"
                        }`}
                    onClick={() => setActiveTab("register")}
                    >
                    Register
                    </button>
                    </div>
                {activeTab === "login" ? (
                    <LoginForm setActiveTab={setActiveTab} redirect={false} />
                ) : (
                    <RegisterForm setActiveTab={setActiveTab} />
                )}
        </Modal>
    );
}