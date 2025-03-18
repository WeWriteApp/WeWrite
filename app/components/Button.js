import React from "react";

const Button = ({ children, onClick, disabled, type = "primary", variant = "default", className = "" }) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors duration-200 shadow-sm";
  
  const pillStyles = `
    inline-flex items-center justify-center
    bg-[#0057FF]
    border-[1.5px] border-[rgba(255,255,255,0.3)]
    text-white
    text-sm
    px-3 py-1.5
    rounded-[12px]
    hover:bg-[#0046CC]
    hover:border-[rgba(255,255,255,0.5)]
  `;
  
  const defaultStyles = type === "secondary" 
    ? "bg-secondary text-secondary-foreground py-2 px-4 rounded-md border-[1.5px] border-border hover:bg-secondary/80"
    : "bg-primary text-primary-foreground py-2 px-4 rounded-md border-[1.5px] border-primary/30 hover:bg-primary/90";

  // Add icon variant support
  const iconStyles = "h-10 w-10 p-0 flex items-center justify-center";
  
  // Add specific styling for SVG icons to ensure they're visible
  const enhancedChildren = React.Children.map(children, child => {
    if (React.isValidElement(child) && child.type === 'svg') {
      return React.cloneElement(child, {
        className: `h-5 w-5 stroke-current ${child.props.className || ''}`
      });
    }
    return child;
  });
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseStyles}
        ${variant === "pill" ? pillStyles : variant === "icon" ? iconStyles : defaultStyles}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {enhancedChildren || children}
    </button>
  );
}

export default Button;