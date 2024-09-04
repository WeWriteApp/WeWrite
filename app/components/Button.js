import React, { useEffect, useState } from "react";

const Button = ({ children, onClick, disabled, type = "primary" }) => {

  if (type === "secondary") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`bg-gray-500 text-white font-bold py-2 px-4 rounded ${
          disabled ? "cursor-not-allowed" : ""
        }`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-blue-500 text-white font-bold py-2 px-4 rounded ${
        disabled ? "cursor-not-allowed" : ""
      }`}
    >
      {children}
    </button>
  );
}

export default Button;