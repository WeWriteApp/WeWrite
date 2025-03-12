import React from "react";

const Button = ({ children, onClick, disabled, type = "primary", variant = "default" }) => {
  const baseStyles = "font-medium transition-colors duration-200";
  const pillStyles = `
    relative
    inline-block whitespace-nowrap
    bg-[#0057FF]
    text-white text-sm
    px-3 py-1.5
    rounded-[12px]
    before:content-['']
    before:absolute before:inset-0
    before:rounded-[12px]
    before:border before:border-white/30
    before:shadow-[inset_0_0_16px_rgba(255,255,255,0.3)]
    hover:bg-[#0046CC]
  `;
  
  const defaultStyles = type === "secondary" 
    ? "bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600"
    : "bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseStyles}
        ${variant === "pill" ? pillStyles : defaultStyles}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      {children}
    </button>
  );
}

export default Button;