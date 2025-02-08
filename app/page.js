"use client";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-background text-center px-6">
      <div className="max-w-4xl">
        <img
          src="/white.svg"
          alt="Hero Logo"
          className="w-32 mx-auto"
        />
        {/* Animated Headline */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-6xl md:text-6xl font-extrabold text-text leading-tight"
        >
          Your Words. Your Impact.  
          <motion.span
            animate={{
              color: ["#2563eb", "#9333ea", "#dc2626", "#2563eb"],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600"
          >
            {" "}Your Purpose.
          </motion.span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="text-lg md:text-xl text-gray-500 mt-6 max-w-2xl mx-auto"
        >
          WeWrite helps you craft, share, and monetize your content effortlessly.  
          Join a community where your words **truly make an impact**.
        </motion.p>

        {/* CTA Button with Pulse Effect */}
        <motion.div 
          className="mt-8"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <a 
            href="/pages" 
            className="bg-primary hover:bg-blue-700 text-white text-lg font-semibold py-3 px-6 rounded-md transition duration-300 shadow-lg"
          >
            Get Started
          </a>
        </motion.div>
      </div>
    </div>
  );
}