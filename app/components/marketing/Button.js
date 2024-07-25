"use client";
import { Icon } from "@iconify/react/dist/iconify.js";
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
      className="bg-black text-white pl-4 pr-2 py-2 rounded-full inline-flex items-center text-md hover:bg-gray-800"
    >
      {text}
      <div className="ml-4 bg-white rounded-full p-1">
        <Icon icon="akar-icons:arrow-right" className="text-black text-xl" />
      </div>
    </Link>
  );
};

export default Button;