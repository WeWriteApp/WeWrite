"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const Button = ({
  text = "Get in touch",
  size = "md",
  type = "primary",
  href = "#",
}) => {
  return (
    <Link
      href={href}
      className="bg-white text-black px-6 py-3 rounded-full font-medium flex items-center gap-2 hover:bg-white/90 transition-colors"
    >
      {text}
      <ArrowRight className="h-5 w-5" />
    </Link>
  );
};

export default Button;